package com.linkqr.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class AuthSession(
    val token: String,
    val userId: String,
    val email: String,
    val name: String?,
    val expiresAt: Long
)

class AuthSessionStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(): AuthSession? {
        val encoded = preferences.getString(KEY_SESSION, null) ?: return null
        val session = runCatching {
            val encrypted = Base64.decode(encoded, Base64.NO_WRAP)
            require(encrypted.size > IV_LENGTH)
            val iv = encrypted.copyOfRange(0, IV_LENGTH)
            val ciphertext = encrypted.copyOfRange(IV_LENGTH, encrypted.size)

            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(128, iv)
            )
            val json = JSONObject(
                cipher.doFinal(ciphertext).toString(StandardCharsets.UTF_8)
            )
            AuthSession(
                token = json.getString("token"),
                userId = json.getString("userId"),
                email = json.getString("email"),
                name = json.optString("name").takeUnless { it.isBlank() || it == "null" },
                expiresAt = json.getLong("expiresAt")
            )
        }.getOrNull()

        if (session == null || session.expiresAt <= System.currentTimeMillis()) {
            clear()
            return null
        }

        return session
    }

    fun save(session: AuthSession) {
        val json = JSONObject()
            .put("token", session.token)
            .put("userId", session.userId)
            .put("email", session.email)
            .put("name", session.name)
            .put("expiresAt", session.expiresAt)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val ciphertext = cipher.doFinal(
            json.toString().toByteArray(StandardCharsets.UTF_8)
        )
        val encrypted = cipher.iv + ciphertext

        preferences.edit()
            .putString(KEY_SESSION, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply()
    }

    fun clear() {
        preferences.edit().remove(KEY_SESSION).apply()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val PREFS_NAME = "linkqr_auth"
        const val KEY_SESSION = "encrypted_session"
        const val KEY_ALIAS = "linkqr_auth_key"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_LENGTH = 12
    }
}
