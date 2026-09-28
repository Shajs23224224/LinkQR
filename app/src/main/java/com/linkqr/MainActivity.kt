package com.linkqr

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.navigation.compose.rememberNavController
import com.linkqr.core.di.AppContainer
import com.linkqr.core.navigation.LinkQrNavHost

class MainActivity : ComponentActivity() {

    private val appContainer by lazy {
        AppContainer(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val navController = rememberNavController()

            MaterialTheme {
                Surface {
                    LinkQrNavHost(
                        navController = navController,
                        qrHistoryRepository = appContainer.qrHistoryRepository
                    )
                }
            }
        }
    }
}
