#!/bin/sh

APP_HOME=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ ! -f "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" ]; then
    if command -v gradle >/dev/null 2>&1; then
        echo "Gradle Wrapper JAR missing; generating Gradle Wrapper 9.4..."
        gradle wrapper --gradle-version 9.4 || exit $?
    else
        echo "ERROR: Gradle Wrapper JAR is missing and Gradle is not installed."
        echo 'Run "gradle wrapper --gradle-version 9.4" from the project root.'
        exit 1
    fi
fi

CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"
exec java -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
