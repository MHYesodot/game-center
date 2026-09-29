# Platform Targets

Status: Accepted source of truth for client platform targets and capability boundaries

## First-class Targets

- Web
- Windows Desktop
- macOS Desktop
- Android
- iPhone
- iPad

## Web

- React
- TypeScript
- Vite

Web is a full platform client, not merely a marketing surface.

## Desktop

- Tauri 2
- targets: Windows and macOS
- future path: `apps/desktop`

Desktop shell responsibilities later:

- native game launching
- installation
- updates
- filesystem access
- native notifications
- protocol and deep-link handling
- secure local storage
- process management

React UI must not perform native operations directly; native capabilities go through Tauri commands and capability boundaries.

## Mobile

- React Native
- Expo
- TypeScript
- targets: Android, iPhone, iPad
- future path: `apps/mobile`

Mobile is a real application, not a WebView wrapper.

## iPad

iPad is first-class and must support:

- tablet navigation
- split views
- landscape
- portrait
- expanded lobby and game surfaces

## Platform Capability Abstraction

Required direction:

```ts
interface PlatformCapabilities {
  notifications: NotificationCapability
  secureStorage: SecureStorageCapability
  deepLinks: DeepLinkCapability
  appLifecycle: AppLifecycleCapability
}
```

Desktop-specialized capability areas:

- gameInstall
- gameLaunch
- fileSystem
- autoUpdate

Mobile-specialized capability areas:

- pushNotifications
- backgroundLifecycle
- storeDeepLinks

## Distribution Reality

Desktop can install and launch native game executables.

Mobile cannot assume arbitrary executable download and launch. Mobile games must be designed around one of these strategies:

- bundled game modules
- separate native apps
- web games
- deep-linked installed games

Game manifests must declare platform availability and future distribution strategy metadata.