package com.linkqr.monetization

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class PlayBillingManager(
    context: Context,
    private val onProEntitlementChanged: (Boolean) -> Unit
) {

    private val appContext = context.applicationContext
    private val preferences =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(
        BillingUiState(isPro = preferences.getBoolean(KEY_PRO_ENTITLED, false))
    )
    val state: StateFlow<BillingUiState> = _state

    private var productDetails: ProductDetails? = null

    init {
        onProEntitlementChanged(_state.value.isPro)
    }

    private val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
        when (billingResult.responseCode) {
            BillingResponseCode.OK -> purchases.orEmpty().forEach(::processPurchase)

            BillingResponseCode.USER_CANCELED -> {
                updateState {
                    it.copy(
                        isLoading = false,
                        message = "Compra cancelada."
                    )
                }
            }

            else -> {
                updateState {
                    it.copy(
                        isLoading = false,
                        message = "No fue posible completar la compra."
                    )
                }
            }
        }
    }

    private val billingClient: BillingClient = BillingClient.newBuilder(appContext)
        .setListener(purchasesUpdatedListener)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .enableAutoServiceReconnection()
        .build()

    fun start() {
        if (billingClient.isReady) {
            queryProduct()
            refreshPurchases()
            return
        }

        updateState { it.copy(isLoading = true) }

        billingClient.startConnection(
            object : com.android.billingclient.api.BillingClientStateListener {
                override fun onBillingSetupFinished(billingResult: BillingResult) {
                    if (billingResult.responseCode == BillingResponseCode.OK) {
                        updateState {
                            it.copy(
                                isLoading = false,
                                message = null
                            )
                        }
                        queryProduct()
                        refreshPurchases()
                    } else {
                        updateState {
                            it.copy(
                                isLoading = false,
                                productAvailable = false,
                                message = "Google Play Billing no está disponible."
                            )
                        }
                    }
                }

                override fun onBillingServiceDisconnected() {
                    updateState {
                        it.copy(
                            isLoading = false,
                            message = "La conexión con Google Play no está disponible."
                        )
                    }
                }
            }
        )
    }

    fun refreshPurchases() {
        if (!billingClient.isReady) {
            start()
            return
        }

        billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ) { billingResult, purchases ->
            if (billingResult.responseCode != BillingResponseCode.OK) {
                return@queryPurchasesAsync
            }

            val proPurchase = purchases.firstOrNull { purchase ->
                ProBillingConfig.PRO_PRODUCT_ID in purchase.products &&
                    purchase.purchaseState == Purchase.PurchaseState.PURCHASED
            }

            if (proPurchase != null) {
                grantPro(proPurchase)
                return@queryPurchasesAsync
            }

            val pending = purchases.any { purchase ->
                ProBillingConfig.PRO_PRODUCT_ID in purchase.products &&
                    purchase.purchaseState == Purchase.PurchaseState.PENDING
            }

            if (!pending) {
                setProEntitlement(false)
            } else {
                updateState {
                    it.copy(
                        isLoading = false,
                        purchasePending = true,
                        message = "La compra PRO está pendiente de pago."
                    )
                }
            }
        }
    }

    fun launchProPurchase(activity: Activity): BillingResult? {
        if (!billingClient.isReady) {
            start()
            return null
        }

        val details = productDetails ?: run {
            updateState {
                it.copy(message = "El producto PRO no está disponible.")
            }
            return null
        }

        val offer = details.oneTimePurchaseOfferDetailsList
            .orEmpty()
            .firstOrNull()

        if (offer == null) {
            updateState {
                it.copy(
                    isLoading = false,
                    message = "No hay una oferta PRO disponible para esta cuenta."
                )
            }
            return null
        }

        updateState {
            it.copy(
                isLoading = true,
                purchasePending = false,
                message = null
            )
        }

        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offer.offerToken)
            .build()

        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .build()

        return billingClient.launchBillingFlow(activity, params)
    }

    fun endConnection() {
        billingClient.endConnection()
    }

    private fun queryProduct() {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(ProBillingConfig.PRO_PRODUCT_ID)
            .setProductType(BillingClient.ProductType.INAPP)
            .build()

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(product))
            .build()

        billingClient.queryProductDetailsAsync(params) { billingResult, result ->
            if (billingResult.responseCode != BillingResponseCode.OK) {
                updateState {
                    it.copy(
                        productAvailable = false,
                        priceLabel = null
                    )
                }
                return@queryProductDetailsAsync
            }

            val details = result.productDetailsList.firstOrNull()
            productDetails = details

            updateState {
                it.copy(
                    productAvailable = details
                        ?.oneTimePurchaseOfferDetailsList
                        .orEmpty()
                        .isNotEmpty(),
                    priceLabel = details
                        ?.oneTimePurchaseOfferDetailsList
                        ?.firstOrNull()
                        ?.formattedPrice
                )
            }
        }
    }

    private fun processPurchase(purchase: Purchase) {
        if (ProBillingConfig.PRO_PRODUCT_ID !in purchase.products) return

        when (purchase.purchaseState) {
            Purchase.PurchaseState.PENDING -> {
                updateState {
                    it.copy(
                        isLoading = false,
                        purchasePending = true,
                        message = "Compra pendiente. PRO se activará cuando Google Play confirme el pago."
                    )
                }
            }

            Purchase.PurchaseState.PURCHASED -> grantPro(purchase)

            else -> {
                updateState {
                    it.copy(
                        isLoading = false,
                        purchasePending = false
                    )
                }
            }
        }
    }

    private fun grantPro(purchase: Purchase) {
        setProEntitlement(true)
        updateState {
            it.copy(
                isPro = true,
                isLoading = false,
                purchasePending = false,
                message = "LinkQR PRO está activo."
            )
        }

        if (!purchase.isAcknowledged) {
            val params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()

            billingClient.acknowledgePurchase(params) { result ->
                if (result.responseCode != BillingResponseCode.OK) {
                    updateState {
                        it.copy(
                            message = "PRO está activo, pero Google Play aún no confirmó la compra."
                        )
                    }
                }
            }
        }
    }

    private fun setProEntitlement(enabled: Boolean) {
        preferences.edit()
            .putBoolean(KEY_PRO_ENTITLED, enabled)
            .apply()

        onProEntitlementChanged(enabled)

        updateState {
            it.copy(
                isPro = enabled,
                isLoading = false
            )
        }
    }

    private fun updateState(transform: (BillingUiState) -> BillingUiState) {
        _state.value = transform(_state.value)
    }

    private companion object {
        const val PREFS_NAME = "linkqr_billing"
        const val KEY_PRO_ENTITLED = "pro_entitled"
    }
}
