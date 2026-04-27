import java.io.File
import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

// Look for key.properties in project-relative path first, then fallback to absolute.
val localKeystoreFile = rootProject.file("key.properties")
val externalKeystoreFile = file("G:/Android Keys/key.properties")
val keystorePropertiesFile = if (localKeystoreFile.exists()) localKeystoreFile else externalKeystoreFile
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.insightbooksafrica.insightbooks_android"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Align Kotlin bytecode with Java 17. Do not use kotlin { jvmToolchain(17) } here: that forces
    // Gradle to resolve a JDK 17 install for javac/kotlin and fails on machines that only have JDK 21/25
    // unless toolchain auto-provisioning (e.g. Foojay) is configured in settings.gradle.kts.
    @Suppress("DEPRECATION")
    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.insightbooksafrica.insightbooks_android"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Must match pubspec `version: x.y.z+N` — N is versionCode and what the server compares.
        versionCode = flutter.versionCode
        // Keep in sync with pubspec name part; do not hardcode (avoids label "1.0.0.6" while build is still +3).
        versionName = flutter.versionName
        // Resolves ${applicationName} in AndroidManifest.xml for Android Studio / manifest merger.
        manifestPlaceholders["applicationName"] = "android.app.Application"
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                val storePath = keystoreProperties["storeFile"] as String
                storeFile = File(keystorePropertiesFile.parentFile, storePath)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
