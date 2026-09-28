# LinkQR release signing

LinkQR supports secure Android release signing through GitHub Actions without storing the keystore in the repository.

## Required GitHub Secrets for signed releases

Add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

- `LINKQR_KEYSTORE_B64`
- `LINKQR_KEYSTORE_PASSWORD`
- `LINKQR_KEY_ALIAS`
- `LINKQR_KEY_PASSWORD`

The AdMob production secrets remain separate:

- `LINKQR_ADMOB_APP_ID`
- `LINKQR_ADMOB_BANNER_AD_UNIT_ID`
- `LINKQR_ADMOB_INTERSTITIAL_AD_UNIT_ID`
- `LINKQR_ADMOB_REWARDED_AD_UNIT_ID`

## How signing is triggered

Normal pushes and pull requests always run the Android build and tests.

A commit whose message contains `[signed-release]` requests a signed release. Signing is enabled only when all four signing secrets are present. If the marker is present but none of the signing secrets are configured yet, CI emits a warning and produces unsigned APK/AAB artifacts instead of failing the entire build.

Partial signing configuration is treated as an error so a release cannot be accidentally built with an incomplete key configuration.

## Keystore handling

The LinkQR upload keystore must stay outside the repository. Never commit the `.jks` file, Base64 contents, passwords, or private signing material.

To generate the Base64 secret locally:

```bash
base64 -w 0 linkqr-upload.jks
```

## CI outputs

Every successful Android CI run produces:

- Debug APK
- Unit-test reports
- Unsigned release APK/AAB when signing is not active

A successful `[signed-release]` run with all signing secrets configured additionally produces:

- Signed release APK
- Signed release AAB
- APK signature verification


<!-- CI artifact upload conditions use the detect_signing step output. -->
