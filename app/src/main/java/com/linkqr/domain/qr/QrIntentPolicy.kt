package com.linkqr.domain.qr

import android.content.Intent
import android.net.Uri
import com.linkqr.domain.model.QrType

object QrIntentPolicy {

    fun createViewIntent(
        type: QrType,
        payload: String
    ): Intent? {
        if (!QrOpenPolicy.canOpen(type, payload)) return null

        val uri = runCatching {
            Uri.parse(payload.trim())
        }.getOrNull() ?: return null

        return Intent(Intent.ACTION_VIEW, uri)
    }
}
