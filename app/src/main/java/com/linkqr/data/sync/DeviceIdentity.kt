package com.linkqr.data.sync

import android.content.Context
import java.util.UUID

class DeviceIdentity(context: Context) {
    val id: String

    init {
        val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        id = preferences.getString(KEY, null) ?: UUID.randomUUID().toString().also { generated ->
            preferences.edit().putString(KEY, generated).apply()
        }
    }

    private companion object {
        const val PREFERENCES = "linkqr_sync"
        const val KEY = "device_id"
    }
}
