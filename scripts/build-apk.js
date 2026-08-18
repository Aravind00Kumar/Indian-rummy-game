// Automated Android APK Build Script with Auto-Incrementing Version & Build Numbers & Dynamic LAN IP Detection

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'version.json');
const buildGradleFile = path.join(rootDir, 'android', 'app', 'build.gradle');
const apkOutputDir = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
const downloadsDir = path.join(rootDir, 'downloads');

console.log('====================================================');
console.log('🚀 STARTING ANDROID APK AUTOMATED BUILD');
console.log('====================================================');

// Dynamic LAN IP Detection
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
                return iface.address;
            }
        }
    }
    return '192.168.29.56';
}

const localIp = getLocalIpAddress();
console.log(`🌐 Detected Server LAN IP: http://${localIp}:3000`);

// Write config.js with current host IP
const configJsContent = `// Application Server Network Configuration (Auto-Generated at Build Time)
(function() {
    window.APP_CONFIG = {
        SERVER_URL: "http://${localIp}:3000",
        DEFAULT_PORT: 3000
    };
})();
`;
fs.writeFileSync(path.join(rootDir, 'js', 'config.js'), configJsContent, 'utf8');
console.log('✅ Updated js/config.js with server IP address');

// 1. Read and Increment Version
let versionData = {
    versionCode: 1,
    versionName: "1.0.1",
    buildNumber: 1,
    updatedAt: new Date().toISOString(),
    apkUrl: "/api/download_apk",
    releaseNotes: "Performance improvements and server connectivity updates."
};

if (fs.existsSync(versionFile)) {
    try {
        versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    } catch(e) {}
}

versionData.versionCode = (versionData.versionCode || 1) + 1;
versionData.buildNumber = (versionData.buildNumber || 1) + 1;
versionData.updatedAt = new Date().toISOString();

// Update minor patch version
const parts = (versionData.versionName || '1.0.0').split('.');
if (parts.length === 3) {
    parts[2] = versionData.buildNumber.toString();
    versionData.versionName = parts.join('.');
}

console.log(`📦 New Build Version: v${versionData.versionName} (VersionCode: ${versionData.versionCode}, Build #${versionData.buildNumber})`);

// 2. Update Android build.gradle
if (fs.existsSync(buildGradleFile)) {
    let gradleContent = fs.readFileSync(buildGradleFile, 'utf8');
    gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${versionData.versionCode}`);
    gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${versionData.versionName}"`);
    fs.writeFileSync(buildGradleFile, gradleContent, 'utf8');
    console.log('✅ Updated android/app/build.gradle with new versionCode and versionName');
}

// 3. Sync Web Assets to www/
const wwwDir = path.join(rootDir, 'www');
fs.mkdirSync(wwwDir, { recursive: true });
fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(wwwDir, 'index.html'));
fs.copyFileSync(path.join(rootDir, 'style.css'), path.join(wwwDir, 'style.css'));
fs.cpSync(path.join(rootDir, 'js'), path.join(wwwDir, 'js'), { recursive: true });
fs.writeFileSync(path.join(wwwDir, 'version.json'), JSON.stringify(versionData, null, 2), 'utf8');
fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2), 'utf8');
console.log('✅ Web assets and version.json synced to www/');

// 4. Run Capacitor Sync
console.log('⚡ Running Capacitor Sync...');
execSync('npx cap sync android', { cwd: rootDir, stdio: 'inherit' });

// 5. Compile APK with Gradle
const jdk17Dir = path.join(rootDir, 'jdk17', 'jdk-17.0.12+7');
const androidDir = path.join(rootDir, 'android');

console.log('🔨 Compiling Android APK with Gradle and JDK 17...');
const gradlewCmd = `set JAVA_HOME=${jdk17Dir}&& set PATH=${jdk17Dir}\\bin;%PATH%&& gradlew.bat assembleDebug`;
execSync(`cmd /c "${gradlewCmd}"`, { cwd: androidDir, stdio: 'inherit' });

// 6. Copy APK to Downloads Directory
fs.mkdirSync(downloadsDir, { recursive: true });
const generatedApk = path.join(apkOutputDir, 'app-debug.apk');
const publicLatestApk = path.join(downloadsDir, 'rummy-latest.apk');
const publicVersionedApk = path.join(downloadsDir, `rummy-v${versionData.versionName}-b${versionData.buildNumber}.apk`);

if (fs.existsSync(generatedApk)) {
    fs.copyFileSync(generatedApk, publicLatestApk);
    fs.copyFileSync(generatedApk, publicVersionedApk);
    const stats = fs.statSync(publicLatestApk);
    console.log('====================================================');
    console.log(`🎉 APK BUILD SUCCESSFUL!`);
    console.log(`   File: ${publicLatestApk}`);
    console.log(`   Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   Version: v${versionData.versionName} (Build #${versionData.buildNumber})`);
    console.log('====================================================');
} else {
    console.error('❌ Error: Generated APK was not found at ' + generatedApk);
}
