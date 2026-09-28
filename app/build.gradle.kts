plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val admobAppId = providers.gradleProperty("LINKQR_ADMOB_APP_ID")
    .orElse("ca-app-pub-3940256099942544~3347511713")
    .get()

val admobBannerAdUnitId = providers.gradleProperty("LINKQR_ADMOB_BANNER_AD_UNIT_ID")
    .orElse("ca-app-pub-3940256099942544/9214589741")
    .get()

val releaseSaasBaseUrl = providers.gradleProperty("LINKQR_SAAS_BASE_URL")
    .orElse("https://api.example.invalid")
    .get()

fun quoteBuildConfigString(value: String): String =
    "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "com.linkqr"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.linkqr"
        minSdk = 24
        targetSdk = 37
        versionCode = 1
        versionName = "1.0.0"

        manifestPlaceholders["ADMOB_APP_ID"] = admobAppId
    }

    buildTypes {
        debug {
            buildConfigField(
                "String",
                "ADMOB_BANNER_AD_UNIT_ID",
                "\"ca-app-pub-3940256099942544/9214589741\""
            )
            buildConfigField(
                "String",
                "SAAS_BASE_URL",
                quoteBuildConfigString(
                    providers.gradleProperty("LINKQR_SAAS_BASE_URL")
                        .orElse("http://10.0.2.2:8080")
                        .get()
                )
            )
            manifestPlaceholders["ALLOW_CLEARTEXT_TRAFFIC"] = "true"
        }

        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )

            buildConfigField(
                "String",
                "ADMOB_BANNER_AD_UNIT_ID",
                "\"$admobBannerAdUnitId\""
            )
            buildConfigField(
                "String",
                "SAAS_BASE_URL",
                quoteBuildConfigString(releaseSaasBaseUrl)
            )
            manifestPlaceholders["ALLOW_CLEARTEXT_TRAFFIC"] = "false"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.9.5")
    implementation("com.google.zxing:core:3.5.3")

    val cameraVersion = "1.6.2"
    implementation("androidx.camera:camera-core:$cameraVersion")
    implementation("androidx.camera:camera-camera2:$cameraVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraVersion")
    implementation("androidx.camera:camera-view:$cameraVersion")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")

    val roomVersion = "2.8.5"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    implementation("com.android.billingclient:billing:9.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
