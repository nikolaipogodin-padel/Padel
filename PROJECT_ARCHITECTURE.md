# Padel Cup - Project Architecture

## 📱 Overview
**Padel Cup** - мобильное Flutter приложение для управления падел-турнирами и матчами в реальном времени.
- **Language:** Dart
- **Framework:** Flutter
- **Backend:** Supabase (PostgreSQL + Auth)
- **Lines of Code:** ~2846 (main.dart)
- **Status:** Active development

## 🏗️ Architecture

### Core Stack
- **UI Framework:** Flutter with Material Design 3
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth
- **Navigation:** go_router (production-ready routing)
- **State Management:** Provider/Stateful widgets
- **HTTP Client:** Supabase client

### Key Constants & Configuration
```dart
// Colors (AppColors class)
- Primary: Green (#2D9B4F)
- Secondary: Blue (#3498DB)
- Accent: Teal (#00E5A0), Gold (#F59E0B), Orange (#F97316)
- Dark theme support with surface variants

// Supabase
- URL: https://ubturjhwtlydaczovamg.supabase.co
- Auth: Public key embedded (anonKey)
```

## 🎯 Main Features (from code analysis)

### 1. Tournament Management
- Create/View tournaments with statuses (LIVE, OPEN, FINISHED)
- Tournament details, participants, and scheduling
- Real-time tournament statistics and rankings

### 2. Match Flow
- Live match scoring system
- Set-by-set tracking
- Player score input UI
- Real-time score updates to Supabase

### 3. Player Profiles  
- Player profile caching system (`_profileCache`)
- Player statistics and rankings
- Player participation history
- Profile fetching optimization

### 4. Real-Time Updates
- Live score updates during matches
- Global profile cache for performance
- Batch player profile fetching

## 📊 Data Model (Inferred)

### Players
- player_id (UUID)
- name, avatar, rating
- stats (matches_played, wins, losses)

### Tournaments
- tournament_id
- title, description, status
- start_date, end_date
- player_list (many-to-many)

### Matches
- match_id
- tournament_id (FK)
- player1_id, player2_id (FKs)
- sets array of scores
- status (scheduled, live, finished)

### Profiles Cache
- Global in-memory cache to reduce DB queries
- Pre-fetches related player data

## 🎨 UI Pattern

### Navigation Structure
```
- TournamentOSApp (root)
  - Bottom Tab Navigation (go_router)
  - Multiple views with different routing endpoints
```

### Color Scheme
- Light theme: Blue/Green accent
- Dark mode ready with surface variants
- Accessibility colors (text contrast levels)

### Components
- Custom Material Design widgets
- Live score cards with real-time updates
- Tournament list views
- Player profile cards
- Navigation bar with active states

## 🔄 Key Code Patterns

### Profile Fetching
```dart
final Map<String, Map> _profileCache = {};

Future<Map<String, Map>> _fetchProfiles(Set<String> playerIds) async {
  // Fetch only missing profiles
  // Cache results globally
  // Batch Supabase queries
}
```

### Routing
- Uses `go_router` package for navigation
- Named routes for tournaments, matches, profiles
- Deep linking support ready

## 🚀 Development Workflow

### Local Setup
1. Ensure Flutter SDK installed (`flutter --version`)
2. Run `flutter pub get` to install dependencies
3. Configure local environment if needed (Supabase URL/keys can be moved to .env)

### Key Dependencies Expected
```yaml
- flutter
- supabase_flutter
- go_router
- material design components
```

### Build Targets
- iOS (macOS required)
- Android (can build APK)
- Web (via Flutter Web)

## ⚠️ Known Configuration

### Security Considerations
- **Public Key Embedded:** Supabase anonKey is in source code
  - ⚠️ Should be moved to environment variables
  - Risk: Key exposure in GitHub
  - Mitigation: Use Row-Level Security (RLS) in Supabase

### Performance Optimization
- Global profile cache reduces repeated DB queries
- Profile fetching batched to reduce network requests
- Consider pagination for large tournaments

## 📝 Code Organization

### Current Structure
- **main.dart** - 2846 lines containing:
  - Main app entry point
  - All UI screens/views
  - Business logic for tournaments/matches
  - Database queries
  - Routing configuration
  - Color/theme definitions

### Recommended Refactoring (for future)
```
lib/
  ├── main.dart (app entry)
  ├── models/
  │   ├── tournament.dart
  │   ├── match.dart
  │   ├── player.dart
  ├── services/
  │   ├── supabase_service.dart
  │   ├── tournament_service.dart
  │   ├── player_service.dart
  ├── screens/
  │   ├── tournament_list.dart
  │   ├── match_detail.dart
  │   ├── player_profile.dart
  ├── widgets/
  │   ├── tournament_card.dart
  │   ├── live_score_card.dart
  ├── utils/
  │   ├── colors.dart
  │   ├── constants.dart
```

## 🔗 External Dependencies

- **Supabase Flutter SDK** - Database & Auth
- **go_router** - Navigation
- **Material Icons & Themes** - UI Components
- **HTTP/WebSockets** - Real-time updates

## 🎯 Next Steps for Development

1. **Environment Setup**
   - Create `.env` file for API keys (git-ignored)
   - Update Supabase initialization

2. **Feature Development**
   - Real-time match updates via WebSockets
   - Push notifications
   - Offline support

3. **Code Quality**
   - Split main.dart into modules
   - Add unit tests
   - Add widget tests
   - Setup CI/CD

4. **Performance**
   - Implement infinite scroll for tournaments
   - Add image caching
   - Optimize database queries

## 📱 User Flows

### Tournament Creation Flow
1. User selects "New Tournament"
2. Fills tournament details
3. Adds players from list
4. Confirms and tournament goes OPEN
5. Can transition to LIVE once matches start

### Live Match Flow
1. Select match from tournament
2. Interface opens live score card
3. Update scores set by set
4. Confirm match completion
5. Results saved and reflected in leaderboards

### Player Stats View
1. Access player profile
2. See career statistics
3. View tournament history
4. See rating/ranking changes

## 🛠️ Useful Git Workflow

```bash
# View logs
git log --oneline

# Create feature branch
git checkout -b feature/tournament-scheduling

# Commit code
git commit -am "Add tournament scheduling feature"

# Push to origin
git push -u origin feature/tournament-scheduling
```

## 📚 Documentation References

- Flutter Docs: https://flutter.dev/docs
- Supabase Docs: https://supabase.com/docs
- go_router: https://pub.dev/packages/go_router
- Material Design 3: https://m3.material.io/

---

**Last Updated:** May 1, 2026
**Status:** Ready for collaboration
**Contact:** nikolaipogodin-padel
