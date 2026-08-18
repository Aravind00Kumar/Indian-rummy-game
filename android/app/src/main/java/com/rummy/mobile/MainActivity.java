package com.rummy.mobile;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private BroadcastReceiver downloadReceiver = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableEdgeToEdgeCutoutFullscreen();
        setupNativeAppBridge();
        registerDownloadCompleteReceiver();
    }

    @Override
    public void onStart() {
        super.onStart();
        enableEdgeToEdgeCutoutFullscreen();
        setupNativeAppBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        enableEdgeToEdgeCutoutFullscreen();
        setupNativeAppBridge();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (downloadReceiver != null) {
            try {
                unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableEdgeToEdgeCutoutFullscreen();
        }
    }

    private void enableEdgeToEdgeCutoutFullscreen() {
        try {
            Window window = getWindow();
            if (window == null) return;

            // Extend into camera cutout / notch area in landscape & portrait
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }

            // Real full screen immersive sticky mode
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false);
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
            } else {
                View decorView = window.getDecorView();
                if (decorView != null) {
                    decorView.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    );
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void setupNativeAppBridge() {
        try {
            WebView webView = null;
            if (this.bridge != null && this.bridge.getWebView() != null) {
                webView = this.bridge.getWebView();
            } else if (getBridge() != null && getBridge().getWebView() != null) {
                webView = getBridge().getWebView();
            }

            if (webView != null) {
                // Add JavaScript interface for direct native APK download & install
                webView.addJavascriptInterface(new WebAppInterface(), "AndroidApp");

                // Also setup DownloadListener as fallback
                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        downloadAndInstallApk(url);
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private class WebAppInterface {
        @JavascriptInterface
        public void downloadAndInstallApk(String downloadUrl) {
            MainActivity.this.downloadAndInstallApk(downloadUrl);
        }
    }

    public void downloadAndInstallApk(String downloadUrl) {
        if (downloadUrl == null || downloadUrl.isEmpty()) return;

        mainHandler.post(() -> Toast.makeText(getApplicationContext(), "⬇️ Downloading update APK... Please wait.", Toast.LENGTH_SHORT).show());

        executor.execute(() -> {
            try {
                // First check unknown sources permission on Android 8.0+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!getPackageManager().canRequestPackageInstalls()) {
                        mainHandler.post(() -> {
                            Toast.makeText(getApplicationContext(), "⚠️ Please allow installing unknown apps to update.", Toast.LENGTH_LONG).show();
                            try {
                                Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                                permissionIntent.setData(Uri.parse("package:" + getPackageName()));
                                permissionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(permissionIntent);
                            } catch (Exception ex) {
                                ex.printStackTrace();
                            }
                        });
                    }
                }

                // Download directly to app cache/files directory
                File updateFile = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "rummy-latest.apk");
                if (updateFile.exists()) {
                    updateFile.delete();
                }

                URL url = new URL(downloadUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setInstanceFollowRedirects(true);
                conn.connect();

                if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    InputStream input = conn.getInputStream();
                    FileOutputStream output = new FileOutputStream(updateFile);

                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = input.read(buffer)) != -1) {
                        output.write(buffer, 0, bytesRead);
                    }

                    output.flush();
                    output.close();
                    input.close();
                    conn.disconnect();

                    mainHandler.post(() -> {
                        Toast.makeText(getApplicationContext(), "✅ Download complete. Launching installer...", Toast.LENGTH_SHORT).show();
                        installApkFile(updateFile);
                    });
                } else {
                    // Fallback to DownloadManager
                    fallbackToDownloadManager(downloadUrl);
                }
            } catch (Exception e) {
                e.printStackTrace();
                // Fallback to system browser or DownloadManager
                mainHandler.post(() -> fallbackToDownloadManager(downloadUrl));
            }
        });
    }

    private void installApkFile(File apkFile) {
        try {
            if (apkFile == null || !apkFile.exists()) {
                Toast.makeText(getApplicationContext(), "❌ APK file not found.", Toast.LENGTH_SHORT).show();
                return;
            }

            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    apkFile
                );
            } else {
                apkUri = Uri.fromFile(apkFile);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(getApplicationContext(), "Install error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void fallbackToDownloadManager(String downloadUrl) {
        try {
            Uri downloadUri = Uri.parse(downloadUrl);
            DownloadManager.Request request = new DownloadManager.Request(downloadUri);
            request.setMimeType("application/vnd.android.package-archive");
            request.setTitle("Rummy Update");
            request.setDescription("Downloading Rummy update APK...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "rummy-latest.apk");

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(request);
                Toast.makeText(getApplicationContext(), "⬇️ Downloading via DownloadManager... Check notifications.", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception ex) {
                Toast.makeText(getApplicationContext(), "Error: " + ex.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    private void registerDownloadCompleteReceiver() {
        try {
            downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                        long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                        if (downloadId != -1) {
                            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                            if (dm != null) {
                                Uri apkUri = dm.getUriForDownloadedFile(downloadId);
                                if (apkUri != null) {
                                    Intent installIntent = new Intent(Intent.ACTION_VIEW);
                                    installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                                    installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                    try {
                                        startActivity(installIntent);
                                    } catch (Exception e) {
                                        e.printStackTrace();
                                    }
                                }
                            }
                        }
                    }
                }
            };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
            } else {
                registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
