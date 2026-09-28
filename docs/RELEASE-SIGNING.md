# LinkQR signed release

The repository now supports secure release signing through GitHub Actions.

## Required GitHub Secrets

Add these repository secrets under GitHub → Settings → Secrets and variables → Actions:

- `LINKQR_KEYSTORE_B64`
- `LINKQR_KEYSTORE_PASSWORD`
- `LINKQR_KEY_ALIAS`
- `LINKQR_KEY_PASSWORD`

The signed-release workflow also requires the four existing AdMob production secrets.

## Keystore

A PKCS12 upload keystore was generated for LinkQR outside the repository. Keep the `.jks` file and its credentials backed up. Never commit the keystore or passwords.

To create the Base64 secret locally:

```bash
base64 -w 0 linkqr-upload.jks
```

## Release workflow

After the secrets are configured:

1. Open **Actions → Android Signed Release**.
2. Run the workflow manually.
3. It validates the keystore and credentials.
4. It runs unit tests.
5. It builds a signed APK and signed AAB.
6. It verifies the APK signature.
7. It uploads both signed artifacts.

The workflow is intentionally manual so a signing key cannot accidentally be used by every normal push to `main`.
