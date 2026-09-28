package com.linkqr

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { LinkQrApp() }
    }
}

@Composable
private fun LinkQrApp() {
    val navController = rememberNavController()
    MaterialTheme {
        Surface {
            NavHost(navController = navController, startDestination = "home") {
                composable("home") { Text("LinkQR") }
            }
        }
    }
}
