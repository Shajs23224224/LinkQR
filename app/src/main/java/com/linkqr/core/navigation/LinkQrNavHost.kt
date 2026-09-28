package com.linkqr.core.navigation

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable

@Composable
fun LinkQrNavHost(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        composable(Routes.HOME) {
            Text("LinkQR")
        }
        composable(Routes.GENERATOR) {
            Text("Generator")
        }
        composable(Routes.PREVIEW) {
            Text("Preview")
        }
        composable(Routes.HISTORY) {
            Text("History")
        }
        composable(Routes.FAVORITES) {
            Text("Favorites")
        }
        composable(Routes.SCANNER) {
            Text("Scanner")
        }
        composable(Routes.PRO) {
            Text("Pro")
        }
        composable(Routes.SETTINGS) {
            Text("Settings")
        }
    }
}
