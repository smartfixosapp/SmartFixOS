// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    targets: [
        .binaryTarget(
            name: "Capacitor",
            path: "XCFrameworks/Capacitor.xcframework"
        ),
        .binaryTarget(
            name: "Cordova",
            path: "XCFrameworks/Cordova.xcframework"
        ),
        .target(
            name: "CapApp-SPM",
            dependencies: [
                "Capacitor",
                "Cordova"
            ]
        )
    ]
)
