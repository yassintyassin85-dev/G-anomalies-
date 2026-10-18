package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("Gestion des compteurs", appName)
  }

  @Test
  fun `verify web assets exist`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val assetManager = context.assets

    val htmlStream = assetManager.open("index.html")
    assertTrue(htmlStream.available() > 0)
    htmlStream.close()

    val cssStream = assetManager.open("style.css")
    assertTrue(cssStream.available() > 0)
    cssStream.close()

    val jsStream = assetManager.open("app.js")
    assertTrue(jsStream.available() > 0)
    jsStream.close()

    val xlsxStream = assetManager.open("xlsx.full.min.js")
    assertTrue(xlsxStream.available() > 0)
    xlsxStream.close()
  }
}
