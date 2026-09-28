@ECHO OFF
SETLOCAL

IF EXIST "%~dp0gradle\wrapper\gradle-wrapper.jar" GOTO execute

where gradle >nul 2>nul
IF ERRORLEVEL 1 (
  ECHO Gradle Wrapper JAR is missing and Gradle is not installed.
  ECHO Run "gradle wrapper --gradle-version 9.6.0" from the project root.
  EXIT /B 1
)

gradle wrapper --gradle-version 9.6.0
IF ERRORLEVEL 1 EXIT /B %ERRORLEVEL%

:execute
SET CLASSPATH=%~dp0gradle\wrapper\gradle-wrapper.jar
java -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
ENDLOCAL
