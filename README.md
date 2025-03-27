# Flutter Flavor Magic

A powerful tool for managing Flutter app flavors and Firebase configurations with ease.

## Prerequisites

Before getting started, ensure you have the following CLI tools installed:

### Firebase CLI

Install the Firebase CLI to manage your Firebase projects:

```bash
brew install firebase-cli
```

For more information, visit [Firebase CLI documentation](https://firebase.google.com/docs/cli).

### FlutterFire CLI

Install the FlutterFire CLI to configure Firebase in your Flutter project:

```bash
dart pub global activate flutterfire_cli
```

For more information, visit [FlutterFire documentation](https://firebase.flutter.dev/docs/cli/).

## Setup Guide

![Setup Guide](images/sidebar.png)

### Step 1: Configure Flavors


1. Add the Flutter Flavorizr dependency:
   - Package: [flutter_flavorizr](https://pub.dev/packages/flutter_flavorizr)
   - This tool helps set up different app flavors (e.g., development, production)

2. If the flavor creation fails, you can rerun the Flavorizr setup

### Step 2: Create Firebase Projects

1. Create separate Firebase projects for each flavor (e.g., development, production)
2. Skip this step if you already have Firebase projects set up

### Step 3: Configure Firebase

1. Pull Firebase configurations for each flavor
2. Automatic setup for Android and iOS
3. No manual downloading of `google-services.json` or `GoogleService-Info.plist` required
4. Creates Firebase options in the lib/firebase_options directory:

```
lib/
└── firebase_options/
    ├── dev_firebase_options.dart
    └── prod_firebase_options.dart
```

### Step 4: Application Setup (Option)

Create an Application.dart file to manage flavor environment configurations using the provided template.

## Features

- Easy flavor management for Flutter applications
- Automated Firebase configuration for different environments
- Streamlined setup process for both Android and iOS platforms
- Built-in templates for quick configuration

## Support

For more information and updates, please check the documentation or raise an issue in the repository.