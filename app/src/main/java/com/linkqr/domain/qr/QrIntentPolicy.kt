package com.linkqr.domain.qr

import android.content.Intent
import android.net.Uri
import com.linkqr.domain.model.QrType

object QrIntentPolicy {

    fun createViewIntent(
        type: QrType,
        payload: String
    ): Intent? {
        val uri = runCatching { Uri.parse(payload.trim()) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null

        val allowed = when (type) {
            QrType.URL ->
                scheme == "http" || scheme == "https"

            QrType.WHATSAPP ->
                (scheme == "http" || scheme == "https") &&
                    uri.host?.lowercase() == "wa.me"

            QrType.PHONE ->
                scheme == "tel"

            QrType.EMAIL ->
                scheme == "mailto"

            QrType.LOCATION ->
                scheme == "geo"

            QrType.TEXT,
            QrType.WIFI ->
                false
        }

        if (!allowed) return null

        return Intent(Intent.ACTION_VIEW, uri)
    }
}
