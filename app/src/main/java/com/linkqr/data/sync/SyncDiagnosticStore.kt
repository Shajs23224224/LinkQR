package com.linkqr.data.sync

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class SyncDiagnosticEvent(
    val timestampMs: Long,
    val state: String,
    val attempt: Int,
    val pushed: Int = 0,
    val pulled: Int = 0,
    val conflicts: Int = 0,
    val cursor: Long? = null,
    val errorCode: String? = null
)

class SyncDiagnosticStore(context: Context) {

    companion object {
        private const val PREFS_NAME = "linkqr_sync_diagnostics"
        private const val EVENTS_KEY = "events"
        private const val MAX_EVENTS = 20
    }

    private val preferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun record(event: SyncDiagnosticEvent) {
        val events = readInternal().toMutableList()
        events += event

        val trimmed = if (events.size > MAX_EVENTS) {
            events.takeLast(MAX_EVENTS)
        } else {
            events
        }

        val json = JSONArray()
        trimmed.forEach { value ->
            json.put(
                JSONObject().apply {
                    put("timestampMs", value.timestampMs)
                    put("state", value.state)
                    put("attempt", value.attempt)
                    put("pushed", value.pushed)
                    put("pulled", value.pulled)
                    put("conflicts", value.conflicts)
                    if (value.cursor != null) put("cursor", value.cursor)
                    if (value.errorCode != null) put("errorCode", value.errorCode)
                }
            )
        }

        preferences.edit().putString(EVENTS_KEY, json.toString()).apply()
    }

    @Synchronized
    fun snapshot(): List<SyncDiagnosticEvent> = readInternal()

    @Synchronized
    fun clear() {
        preferences.edit().remove(EVENTS_KEY).apply()
    }

    private fun readInternal(): List<SyncDiagnosticEvent> {
        val raw = preferences.getString(EVENTS_KEY, null) ?: return emptyList()

        return runCatching {
            val json = JSONArray(raw)
            buildList(json.length()) {
                for (index in 0 until json.length()) {
                    val item = json.getJSONObject(index)
                    add(
                        SyncDiagnosticEvent(
                            timestampMs = item.getLong("timestampMs"),
                            state = item.getString("state"),
                            attempt = item.getInt("attempt"),
                            pushed = item.optInt("pushed", 0),
                            pulled = item.optInt("pulled", 0),
                            conflicts = item.optInt("conflicts", 0),
                            cursor = if (item.has("cursor")) item.getLong("cursor") else null,
                            errorCode = item.optString("errorCode").ifBlank { null }
                        )
                    )
                }
            }
        }.getOrDefault(emptyList())
    }
}
