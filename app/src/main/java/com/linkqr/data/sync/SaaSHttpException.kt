package com.linkqr.data.sync

import java.io.IOException

class SaaSHttpException(
    val statusCode: Int,
    val errorCode: String
) : IOException("SaaS request failed ($statusCode): $errorCode")
