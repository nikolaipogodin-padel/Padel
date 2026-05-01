import 'dart:math';
import 'dart:typed_data';
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: 'https://ubturjhwtlydaczovamg.supabase.co',
    anonKey: 'sb_publishable_n3nF5rrVGZxQLknikJgXtA_m4QkC8jb',
  );
  runApp(const TournamentOSApp());
}

final supabase = Supabase.instance.client;

class AppColors {
  static const green = Color(0xFF2D9B4F);
  static const greenLight = Color(0xFF2ECC71);
  static const greenDark = Color(0xFF27AE60);
  static const blue = Color(0xFF3498DB);
  static const blueDark = Color(0xFF2980B9);
  static const blueDeep = Color(0xFF1B4FD8);
  static const red = Color(0xFFEF4444);
  static const redCard = Color(0xFFE74C3C);
  static const gold = Color(0xFFF59E0B);
  static const teal = Color(0xFF00E5A0);
  static const bg = Color(0xFFD6EAF5);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceVar = Color(0xFFF0F6FB);
  static const cardBg = Color(0xD9FFFFFF);
  static const textDark = Color(0xFF1A2340);
  static const textDark2 = Color(0xFF2C3E50);
  static const textMuted = Color(0xFF7A90A8);
  static const textMuted2 = Color(0xFF7F8C8D);
  static const border = Color(0xFFCBD9E8);
  static const navActive = Color(0xFF2C3E6E);
  static const orange = Color(0xFFF97316);
}

// ─── Глобальный кеш профилей ──────────────────────────────────────────────────
final Map<String, Map> _profileCache = {};

Future<Map<String, Map>> _fetchProfiles(Set<String> playerIds) async {
  if (playerIds.isEmpty) return {};
  final missing = playerIds.where((id) => !_profileCache.containsKey(id)).toSet();
  if (missing.isNotEmpty) {
    try {
      final rows = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .inFilter('id', missing.toList());
      for (final r in rows as List) {
        _profileCache[r['id'] as String] = r as Map;
      }
    } catch (_) {}
    final stillMissing = missing.where((id) => !_profileCache.containsKey(id)).toList();
    if (stillMissing.isNotEmpty) {
      try {
        final rows = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .inFilter('id', stillMissing);
        for (final r in rows as List) {
          _profileCache[r['id'] as String] = r as Map;
        }
      } catch (_) {}
    }
  }
  return {for (final id in playerIds) id: _profileCache[id] ?? {}};
}

Future<bool> _isProfileComplete() async {
  final uid = supabase.auth.currentUser?.id;
  if (uid == null) return false;
  try {
    final row = await supabase
        .from('profiles')
        .select('first_name, last_name, level, gender, role')
        .eq('id', uid)
        .maybeSingle();
    if (row == null) return false;
    return (row['first_name'] as String?)?.isNotEmpty == true &&
        (row['last_name'] as String?)?.isNotEmpty == true &&
        (row['level'] as String?)?.isNotEmpty == true &&
        (row['gender'] as String?)?.isNotEmpty == true &&
        (row['role'] as String?)?.isNotEmpty == true;
  } catch (_) {
    return false;
  }
}

Future<String?> _getMyRole() async {
  final uid = supabase.auth.currentUser?.id;
  if (uid == null) return null;
  try {
    final row = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();
    return row?['role'] as String?;
  } catch (_) {
    return null;
  }
}

final _router = GoRouter(
  initialLocation: supabase.auth.currentSession != null ? '/' : '/auth',
  redirect: (context, state) async {
    final loggedIn = supabase.auth.currentSession != null;
    final onAuth = state.matchedLocation == '/auth';
    final onReset = state.matchedLocation == '/reset';
    final onProfile = state.matchedLocation == '/profile';
    if (!loggedIn) return (onAuth || onReset) ? null : '/auth';
    if (onAuth) return '/';
    if (!onProfile && !onReset) {
      final complete = await _isProfileComplete();
      if (!complete) return '/profile';
    }
    return null;
  },
  routes: [
    GoRoute(path: '/auth', builder: (_, __) => const AuthScreen()),
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    GoRoute(path: '/reset', builder: (_, __) => const ResetPasswordScreen()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
    GoRoute(path: '/organizer', builder: (_, __) => const OrganizerScreen()),
    GoRoute(path: '/organizer/create', builder: (_, __) => const CreateTournamentScreen()),
    GoRoute(
      path: '/organizer/tournament/:id',
      builder: (_, state) => OrganizerTournamentScreen(tournamentId: state.pathParameters['id']!),
    ),
    // ── Детальный экран турнира для игрока (с кнопкой выхода) ─────────────────
    GoRoute(
      path: '/tournament/:id',
      builder: (_, state) => TournamentDetailScreen(
        tournamentId: state.pathParameters['id']!,
        tournamentName: state.uri.queryParameters['name'] ?? 'Турнир',
      ),
    ),
    GoRoute(
      path: '/matches/:tournamentId',
      builder: (_, state) => LiveMatchesScreen(
        tournamentId: state.pathParameters['tournamentId']!,
        tournamentName: state.uri.queryParameters['name'] ?? 'Турнир',
      ),
    ),
  ],
);

class TournamentOSApp extends StatelessWidget {
  const TournamentOSApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Tournament OS',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(),
      routerConfig: _router,
    );
  }

  ThemeData _buildTheme() {
    const primary = Color(0xFF2D9B4F);
    const surfaceVar = Color(0xFFF0F6FB);
    const onSurface = Color(0xFF1A2340);
    const onSurfaceMuted = Color(0xFF7A90A8);

    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.bg,
      colorScheme: const ColorScheme.light(
        primary: primary,
        secondary: Color(0xFF1B4FD8),
        surface: Color(0xFFFFFFFF),
        onPrimary: Colors.white,
        onSurface: onSurface,
      ),
      fontFamily: 'Roboto',
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: onSurface,
        titleTextStyle: TextStyle(
          color: onSurface, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Roboto'),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceVar,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD9E8))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD9E8))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: primary, width: 1.5)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFEF4444))),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5)),
        hintStyle: const TextStyle(color: onSurfaceMuted, fontSize: 15),
        errorStyle: const TextStyle(color: Color(0xFFEF4444), fontSize: 12),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary, foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.5),
          elevation: 0,
        ),
      ),
    );
  }
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

enum _AuthState { idle, existingUser }

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with TickerProviderStateMixin {
  final _countryCodeController = TextEditingController(text: '+371');
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _passwordVisible = false;
  bool _confirmPasswordVisible = false;
  bool _isLoading = false;
  String? _errorMessage;
  _AuthState _authState = _AuthState.idle;

  late final AnimationController _fadeController;
  late final AnimationController _slideController;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _slideController = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _fadeAnim = CurvedAnimation(parent: _fadeController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _slideController, curve: Curves.easeOutCubic));
    _fadeController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose(); _slideController.dispose();
    _countryCodeController.dispose(); _phoneController.dispose();
    _passwordController.dispose(); _confirmPasswordController.dispose();
    super.dispose();
  }

  String get _pseudoEmail {
    final digits = _countryCodeController.text.trim().replaceAll(RegExp(r'\D'), '');
    final number = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    return '$digits$number@padel.app';
  }

  String get _fullPhone {
    final rawCode = _countryCodeController.text.trim();
    final code = rawCode.startsWith('+') ? rawCode : '+$rawCode';
    final number = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    return '$code$number';
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isLoading = true; _errorMessage = null; });
    final email = _pseudoEmail; final phone = _fullPhone; final password = _passwordController.text;
    try {
      if (_authState == _AuthState.idle) {
        try {
          final signUpRes = await supabase.auth.signUp(email: email, password: password, data: {'phone': phone});
          if (signUpRes.session != null && mounted) { context.go('/'); return; }
          setState(() => _errorMessage = 'Аккаунт создан, но требует подтверждения.');
          return;
        } on AuthException catch (e) {
          final msg = e.message.toLowerCase();
          if (msg.contains('already registered') || msg.contains('already exists') || msg.contains('already been registered')) {
            setState(() => _authState = _AuthState.existingUser);
          } else { rethrow; }
        }
      }
      final loginRes = await supabase.auth.signInWithPassword(email: email, password: password);
      if (loginRes.session != null && mounted) { context.go('/'); return; }
    } on AuthException catch (e) {
      final msg = e.message.toLowerCase();
      setState(() {
        if (msg.contains('invalid login credentials') || msg.contains('invalid password') || msg.contains('wrong password')) {
          _authState = _AuthState.existingUser;
          _errorMessage = 'Неверный пароль. Попробуйте ещё раз.';
        } else if (msg.contains('rate limit')) {
          _errorMessage = 'Слишком много попыток. Подождите немного.';
        } else { _errorMessage = e.message; }
      });
    } catch (e) { setState(() => _errorMessage = 'Ошибка: $e'); }
    finally { if (mounted) setState(() => _isLoading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final isExisting = _authState == _AuthState.existingUser;
    return Scaffold(body: Stack(children: [
      const _BackgroundDecoration(),
      SafeArea(child: Center(child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: FadeTransition(opacity: _fadeAnim, child: SlideTransition(position: _slideAnim,
          child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 400),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _buildHeader(), const SizedBox(height: 40),
              _buildForm(showConfirm: !isExisting),
              if (_errorMessage != null) ...[const SizedBox(height: 12), _buildError()],
              const SizedBox(height: 24),
              _buildSubmitButton(isExisting: isExisting),
              const SizedBox(height: 16),
              _buildForgotPassword(),
            ]),
          ),
        )),
      ))),
    ]));
  }

  Widget _buildHeader() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Container(width: 52, height: 52,
      decoration: BoxDecoration(color: const Color(0xFF00E5A0).withOpacity(0.12), borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF00E5A0).withOpacity(0.3))),
      child: const Center(child: Text('T', style: TextStyle(color: Color(0xFF00E5A0), fontSize: 26, fontWeight: FontWeight.w800)))),
    const SizedBox(height: 20),
    const Text('Padel Cup', style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
    const SizedBox(height: 6),
    const Text('Введите номер телефона для входа\nили создания аккаунта',
      style: TextStyle(color: Color(0xFF64748B), fontSize: 15, height: 1.5)),
  ]);

  Widget _buildForm({required bool showConfirm}) => Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const _FieldLabel('Номер телефона'), const SizedBox(height: 8),
    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 80, child: TextFormField(controller: _countryCodeController, keyboardType: TextInputType.phone,
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[+\d]')), LengthLimitingTextInputFormatter(5)],
        style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15, fontWeight: FontWeight.w600),
        textAlign: TextAlign.center, decoration: const InputDecoration(hintText: '+371'))),
      const SizedBox(width: 10),
      Expanded(child: TextFormField(controller: _phoneController, keyboardType: TextInputType.phone,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(15)],
        style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15),
        decoration: const InputDecoration(hintText: '20000000'),
        validator: (v) => (v == null || v.trim().length < 7) ? 'Введите корректный номер' : null)),
    ]),
    const SizedBox(height: 16),
    const _FieldLabel('Пароль'), const SizedBox(height: 8),
    TextFormField(controller: _passwordController, obscureText: !_passwordVisible,
      style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15),
      decoration: InputDecoration(hintText: 'Введите пароль',
        suffixIcon: _VisibilityToggle(visible: _passwordVisible, onToggle: () => setState(() => _passwordVisible = !_passwordVisible))),
      validator: (v) { if (v == null || v.isEmpty) return 'Введите пароль'; if (v.length < 6) return 'Минимум 6 символов'; return null; }),
    if (showConfirm) ...[
      const SizedBox(height: 16),
      const _FieldLabel('Подтверждение пароля'), const SizedBox(height: 8),
      TextFormField(controller: _confirmPasswordController, obscureText: !_confirmPasswordVisible,
        style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15),
        decoration: InputDecoration(hintText: 'Повторите пароль',
          suffixIcon: _VisibilityToggle(visible: _confirmPasswordVisible, onToggle: () => setState(() => _confirmPasswordVisible = !_confirmPasswordVisible))),
        validator: (v) { if (v == null || v.isEmpty) return 'Подтвердите пароль'; if (v != _passwordController.text) return 'Пароли не совпадают'; return null; }),
    ],
  ]));

  Widget _buildError() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(color: const Color(0xFFEF4444).withOpacity(0.1),
      borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3))),
    child: Row(children: [
      const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 18), const SizedBox(width: 10),
      Expanded(child: Text(_errorMessage!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13, height: 1.4))),
    ]));

  Widget _buildSubmitButton({required bool isExisting}) => ElevatedButton(
    onPressed: _isLoading ? null : _handleSubmit,
    style: ElevatedButton.styleFrom(disabledBackgroundColor: const Color(0xFF00E5A0).withOpacity(0.4)),
    child: _isLoading
        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0A0E1A)))
        : Text(isExisting ? 'Войти' : 'Зарегистрироваться'));

  Widget _buildForgotPassword() => Center(child: TextButton(
    onPressed: () => context.push('/reset'),
    child: const Text('Забыли пароль?', style: TextStyle(color: Color(0xFF64748B), fontSize: 14,
      decoration: TextDecoration.underline, decorationColor: Color(0xFF64748B)))));
}

// ─── Reset Password Screen ────────────────────────────────────────────────────

enum _ResetStep { enterPhone, enterOtp, newPassword }

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});
  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _countryCodeController = TextEditingController(text: '+371');
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmNewPasswordController = TextEditingController();

  _ResetStep _step = _ResetStep.enterPhone;
  bool _isLoading = false;
  bool _passwordVisible = false;
  bool _confirmVisible = false;
  String? _errorMessage;
  String? _infoMessage;

  String get _pseudoEmail {
    final digits = _countryCodeController.text.trim().replaceAll(RegExp(r'\D'), '');
    final number = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    return '$digits$number@padel.app';
  }

  Future<void> _sendOtp() async {
    if (_phoneController.text.trim().length < 7) { setState(() => _errorMessage = 'Введите корректный номер'); return; }
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      await supabase.auth.resetPasswordForEmail(_pseudoEmail);
      setState(() { _step = _ResetStep.enterOtp; _infoMessage = 'Код отправлен. Введите 6-значный код из письма.'; });
    } on AuthException catch (e) { setState(() => _errorMessage = e.message); }
    finally { if (mounted) setState(() => _isLoading = false); }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length < 6) { setState(() => _errorMessage = 'Введите 6-значный код'); return; }
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      await supabase.auth.verifyOTP(email: _pseudoEmail, token: otp, type: OtpType.recovery);
      setState(() { _step = _ResetStep.newPassword; _infoMessage = null; });
    } on AuthException catch (e) { setState(() => _errorMessage = 'Неверный код: ${e.message}'); }
    finally { if (mounted) setState(() => _isLoading = false); }
  }

  Future<void> _updatePassword() async {
    final pass = _newPasswordController.text;
    final confirm = _confirmNewPasswordController.text;
    if (pass.length < 6) { setState(() => _errorMessage = 'Минимум 6 символов'); return; }
    if (pass != confirm) { setState(() => _errorMessage = 'Пароли не совпадают'); return; }
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      await supabase.auth.updateUser(UserAttributes(password: pass));
      if (mounted) context.go('/');
    } on AuthException catch (e) { setState(() => _errorMessage = e.message); }
    finally { if (mounted) setState(() => _isLoading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: Stack(children: [
      const _BackgroundDecoration(),
      SafeArea(child: Column(children: [
        Align(alignment: Alignment.centerLeft, child: Padding(padding: const EdgeInsets.all(8),
          child: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF94A3B8)), onPressed: () => context.go('/auth')))),
        Expanded(child: Center(child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 400),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _buildHeader(), const SizedBox(height: 32), _buildBody(),
              if (_errorMessage != null) ...[const SizedBox(height: 12), _buildBanner(_errorMessage!, isError: true)],
              if (_infoMessage != null) ...[const SizedBox(height: 12), _buildBanner(_infoMessage!, isError: false)],
              const SizedBox(height: 24), _buildButton(),
            ])),
        ))),
      ])),
    ]));
  }

  Widget _buildHeader() {
    final titles = { _ResetStep.enterPhone: 'Восстановление\nпароля', _ResetStep.enterOtp: 'Введите код', _ResetStep.newPassword: 'Новый пароль' };
    final subtitles = { _ResetStep.enterPhone: 'Введите номер телефона аккаунта', _ResetStep.enterOtp: 'Код из письма на вашем аккаунте', _ResetStep.newPassword: 'Придумайте новый пароль' };
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: 52, height: 52,
        decoration: BoxDecoration(color: const Color(0xFF00E5A0).withOpacity(0.12), borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF00E5A0).withOpacity(0.3))),
        child: const Center(child: Icon(Icons.lock_reset_rounded, color: Color(0xFF00E5A0), size: 26))),
      const SizedBox(height: 20),
      Text(titles[_step]!, style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, height: 1.2)),
      const SizedBox(height: 8),
      Text(subtitles[_step]!, style: const TextStyle(color: Color(0xFF64748B), fontSize: 15, height: 1.5)),
    ]);
  }

  Widget _buildBody() {
    switch (_step) {
      case _ResetStep.enterPhone:
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 80, child: TextFormField(controller: _countryCodeController, keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[+\d]')), LengthLimitingTextInputFormatter(5)],
            style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center, decoration: const InputDecoration(hintText: '+371'))),
          const SizedBox(width: 10),
          Expanded(child: TextFormField(controller: _phoneController, keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(15)],
            style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15),
            decoration: const InputDecoration(hintText: '20000000'))),
        ]);
      case _ResetStep.enterOtp:
        return TextFormField(controller: _otpController, keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 22, letterSpacing: 8),
          textAlign: TextAlign.center, decoration: const InputDecoration(hintText: '000000'));
      case _ResetStep.newPassword:
        return Column(children: [
          TextFormField(controller: _newPasswordController, obscureText: !_passwordVisible,
            style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15),
            decoration: InputDecoration(hintText: 'Новый пароль',
              suffixIcon: _VisibilityToggle(visible: _passwordVisible, onToggle: () => setState(() => _passwordVisible = !_passwordVisible)))),
          const SizedBox(height: 12),
          TextFormField(controller: _confirmNewPasswordController, obscureText: !_confirmVisible,
            style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 15),
            decoration: InputDecoration(hintText: 'Повторите пароль',
              suffixIcon: _VisibilityToggle(visible: _confirmVisible, onToggle: () => setState(() => _confirmVisible = !_confirmVisible)))),
        ]);
    }
  }

  Widget _buildBanner(String text, {required bool isError}) {
    final color = isError ? const Color(0xFFEF4444) : const Color(0xFF00E5A0);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withOpacity(0.3))),
      child: Row(children: [
        Icon(isError ? Icons.error_outline_rounded : Icons.info_outline_rounded, color: color, size: 18), const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(color: color, fontSize: 13, height: 1.4))),
      ]));
  }

  Widget _buildButton() {
    final labels = { _ResetStep.enterPhone: 'Отправить код', _ResetStep.enterOtp: 'Подтвердить', _ResetStep.newPassword: 'Сохранить пароль' };
    final actions = { _ResetStep.enterPhone: _sendOtp, _ResetStep.enterOtp: _verifyOtp, _ResetStep.newPassword: _updatePassword };
    return ElevatedButton(
      onPressed: _isLoading ? null : actions[_step],
      style: ElevatedButton.styleFrom(disabledBackgroundColor: const Color(0xFF00E5A0).withOpacity(0.4)),
      child: _isLoading
          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0A0E1A)))
          : Text(labels[_step]!));
  }
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;
  String? _successMessage;

  String _phone = '';
  String? _selectedLevel;
  String _gender = 'male';
  String _role = 'player';
  String? _avatarUrl;

  int _matches = 0;
  int _wins = 0;
  double _rating = 0.0;

  static const _levels = ['D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'A'];

  @override
  void initState() { super.initState(); _loadProfile(); }

  @override
  void dispose() { _firstNameController.dispose(); _lastNameController.dispose(); super.dispose(); }

  Future<void> _loadProfile() async {
    final user = supabase.auth.currentUser;
    if (user == null) return;
    _phone = user.userMetadata?['phone'] as String? ?? user.email?.replaceAll('@padel.app', '') ?? '';
    try {
      final row = await supabase.from('profiles').select().eq('id', user.id).maybeSingle();
      if (row != null) {
        _firstNameController.text = row['first_name'] as String? ?? '';
        _lastNameController.text = row['last_name'] as String? ?? '';
        _selectedLevel = row['level'] as String?;
        _gender = row['gender'] as String? ?? 'male';
        _role = row['role'] as String? ?? 'player';
        _avatarUrl = row['avatar_url'] as String?;
        _matches = (row['matches'] as int?) ?? 0;
        _wins = (row['wins'] as int?) ?? 0;
        _rating = ((row['rating'] as num?) ?? 0.0).toDouble();
      }
    } catch (_) {} finally { if (mounted) setState(() => _isLoading = false); }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedLevel == null) { setState(() => _errorMessage = 'Выберите уровень игры'); return; }
    setState(() { _isSaving = true; _errorMessage = null; _successMessage = null; });
    final user = supabase.auth.currentUser!;
    try {
      await supabase.from('profiles').upsert({
        'id': user.id, 'first_name': _firstNameController.text.trim(), 'last_name': _lastNameController.text.trim(),
        'phone': _phone, 'level': _selectedLevel, 'gender': _gender, 'role': _role,
        'avatar_url': _avatarUrl, 'updated_at': DateTime.now().toIso8601String(),
      });
      if (mounted) {
        setState(() => _successMessage = 'Профиль сохранён ✓');
        await Future.delayed(const Duration(milliseconds: 800));
        if (mounted) context.go('/');
      }
    } on PostgrestException catch (e) { setState(() => _errorMessage = 'Ошибка сохранения: ${e.message}'); }
    catch (e) { setState(() => _errorMessage = 'Ошибка: $e'); }
    finally { if (mounted) setState(() => _isSaving = false); }
  }

  Future<void> _signOut() async { await supabase.auth.signOut(); if (mounted) context.go('/auth'); }

  bool _isUploadingAvatar = false;

  Widget _buildAvatar() => Center(child: Stack(clipBehavior: Clip.none, children: [
    GestureDetector(onTap: _isUploadingAvatar ? null : _pickAndUpload,
      child: Container(width: 96, height: 96,
        decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white,
          border: Border.all(color: const Color(0xFF2D9B4F).withOpacity(0.5), width: 2.5)),
        child: _isUploadingAvatar
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2D9B4F)))
            : (_avatarUrl != null
                ? ClipOval(child: Image.network(_avatarUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _defaultAvatarIcon()))
                : _defaultAvatarIcon()))),
    Positioned(bottom: 0, right: -4, child: GestureDetector(onTap: _isUploadingAvatar ? null : _pickAndUpload,
      child: Container(width: 30, height: 30,
        decoration: BoxDecoration(color: const Color(0xFF2D9B4F), shape: BoxShape.circle, border: Border.all(color: const Color(0xFFD6EAF5), width: 2)),
        child: const Icon(Icons.add_rounded, size: 18, color: Colors.white)))),
  ]));

  Widget _defaultAvatarIcon() => const Center(child: Icon(Icons.person_rounded, size: 48, color: Color(0xFF7A90A8)));

  Future<void> _pickAndUpload() async {
    final uploadInput = html.FileUploadInputElement()..accept = 'image/*'..click();
    await uploadInput.onChange.first;
    final file = uploadInput.files?.first;
    if (file == null || !mounted) return;
    setState(() => _isUploadingAvatar = true);
    try {
      final uid = supabase.auth.currentUser!.id;
      final reader = html.FileReader();
      reader.readAsArrayBuffer(file);
      await reader.onLoad.first;
      final bytes = Uint8List.fromList(reader.result as List<int>);
      final path = '$uid/avatar.jpg';
      await supabase.storage.from('avatars').uploadBinary(path, bytes,
        fileOptions: const FileOptions(contentType: 'image/jpeg', upsert: true));
      final publicUrl = supabase.storage.from('avatars').getPublicUrl(path);
      final urlWithBust = '$publicUrl?t=${DateTime.now().millisecondsSinceEpoch}';
      await supabase.from('profiles').update({'avatar_url': publicUrl}).eq('id', uid);
      if (mounted) setState(() => _avatarUrl = urlWithBust);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка загрузки: $e'), backgroundColor: const Color(0xFFEF4444), behavior: SnackBarBehavior.floating));
    } finally { if (mounted) setState(() => _isUploadingAvatar = false); }
  }

  Widget _buildStatsRow() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFCBD9E8))),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
      _statItem('$_matches', 'Матчей'), _divider(), _statItem('$_wins', 'Побед'), _divider(),
      Row(children: [const Icon(Icons.star_rounded, color: Color(0xFFEAB308), size: 16), const SizedBox(width: 4),
        _statItem(_rating == 0.0 ? '—' : _rating.toStringAsFixed(1), 'Рейтинг')]),
    ]));

  Widget _statItem(String value, String label) => Column(children: [
    Text(value, style: const TextStyle(color: Color(0xFF1A2340), fontSize: 16, fontWeight: FontWeight.w700)),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(color: Color(0xFF7A90A8), fontSize: 11)),
  ]);

  Widget _divider() => Container(width: 1, height: 32, color: const Color(0xFFCBD9E8));

  Widget _buildToggle({required String leftLabel, required String rightLabel, required String value,
      required String leftValue, required String rightValue, required ValueChanged<String> onChanged}) =>
    Container(decoration: BoxDecoration(color: const Color(0xFFF0F6FB), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFCBD9E8))),
      child: Row(children: [
        _toggleOption(leftLabel, value == leftValue, () => onChanged(leftValue)),
        _toggleOption(rightLabel, value == rightValue, () => onChanged(rightValue)),
      ]));

  Widget _toggleOption(String label, bool selected, VoidCallback onTap) => Expanded(child: GestureDetector(onTap: onTap,
    child: AnimatedContainer(duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(color: selected ? const Color(0xFF00E5A0) : Colors.transparent, borderRadius: BorderRadius.circular(9)),
      child: Center(child: Text(label, style: TextStyle(color: selected ? Colors.white : const Color(0xFF7A90A8), fontWeight: FontWeight.w700, fontSize: 14))))));

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFF2D9B4F))));
    final fullName = '${_firstNameController.text} ${_lastNameController.text}'.trim();
    final displayName = fullName.isEmpty ? 'Ваш профиль' : fullName;
    return Scaffold(backgroundColor: const Color(0xFFD6EAF5), body: Stack(children: [
      const _BackgroundDecoration(),
      SafeArea(child: Column(children: [
        Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: Row(children: [
          IconButton(icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF7A90A8)),
            onPressed: () async { final complete = await _isProfileComplete(); if (mounted && complete) context.go('/'); }),
          const Expanded(child: Text('Профиль', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF1A2340), fontSize: 18, fontWeight: FontWeight.w700))),
          const SizedBox(width: 48),
        ])),
        Expanded(child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 480),
            child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _buildAvatar(), const SizedBox(height: 16),
              Center(child: Text(displayName, style: const TextStyle(color: Color(0xFF1A2340), fontSize: 22, fontWeight: FontWeight.w800))),
              const SizedBox(height: 4),
              Center(child: Text(_phone, style: const TextStyle(color: Color(0xFF7A90A8), fontSize: 14))),
              const SizedBox(height: 20), _buildStatsRow(), const SizedBox(height: 28),
              const _FieldLabel('Имя'), const SizedBox(height: 8),
              TextFormField(controller: _firstNameController, onChanged: (_) => setState(() {}),
                style: const TextStyle(color: Color(0xFF1A2340), fontSize: 15),
                decoration: const InputDecoration(hintText: 'Введите имя'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Обязательное поле' : null),
              const SizedBox(height: 16),
              const _FieldLabel('Фамилия'), const SizedBox(height: 8),
              TextFormField(controller: _lastNameController, onChanged: (_) => setState(() {}),
                style: const TextStyle(color: Color(0xFF1A2340), fontSize: 15),
                decoration: const InputDecoration(hintText: 'Введите фамилию'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Обязательное поле' : null),
              const SizedBox(height: 16),
              const _FieldLabel('Телефон'), const SizedBox(height: 8),
              Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF2D3748))),
                child: Text(_phone, style: const TextStyle(color: Color(0xFF7A90A8), fontSize: 15))),
              const SizedBox(height: 16),
              const _FieldLabel('Уровень'), const SizedBox(height: 8),
              Container(padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _selectedLevel == null ? const Color(0xFFEF4444).withOpacity(0.5) : const Color(0xFFCBD9E8))),
                child: DropdownButtonHideUnderline(child: DropdownButton<String>(value: _selectedLevel,
                  hint: const Text('Выберите уровень', style: TextStyle(color: Color(0xFF7A90A8), fontSize: 15)),
                  isExpanded: true, dropdownColor: Colors.white,
                  icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF7A90A8)),
                  style: const TextStyle(color: Color(0xFF1A2340), fontSize: 15),
                  items: _levels.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
                  onChanged: (v) => setState(() => _selectedLevel = v)))),
              const SizedBox(height: 16),
              const _FieldLabel('Пол'), const SizedBox(height: 8),
              _buildToggle(leftLabel: 'Мужчина', rightLabel: 'Женщина', value: _gender, leftValue: 'male', rightValue: 'female', onChanged: (v) => setState(() => _gender = v)),
              const SizedBox(height: 16),
              const _FieldLabel('Роль'), const SizedBox(height: 8),
              _buildToggle(leftLabel: 'Player', rightLabel: 'Organizer', value: _role, leftValue: 'player', rightValue: 'organizer', onChanged: (v) => setState(() => _role = v)),
              const SizedBox(height: 12),
              if (_errorMessage != null) ...[const SizedBox(height: 4), _buildBanner(_errorMessage!, isError: true)],
              if (_successMessage != null) ...[const SizedBox(height: 4), _buildBanner(_successMessage!, isError: false)],
              const SizedBox(height: 24),
              ElevatedButton(onPressed: _isSaving ? null : _saveProfile,
                style: ElevatedButton.styleFrom(disabledBackgroundColor: const Color(0xFF2D9B4F).withOpacity(0.4)),
                child: _isSaving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Сохранить')),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _signOut,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
                child: const Text('Выйти из аккаунта', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
              const SizedBox(height: 32),
            ]))),
        )),
      ])),
    ]));
  }

  Widget _buildBanner(String text, {required bool isError}) {
    final color = isError ? const Color(0xFFEF4444) : const Color(0xFF2D9B4F);
    return Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withOpacity(0.3))),
      child: Row(children: [
        Icon(isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, color: color, size: 18), const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(color: color, fontSize: 13, height: 1.4))),
      ]));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT DETAIL SCREEN — детали турнира + кнопка выхода
// ═══════════════════════════════════════════════════════════════════════════════

class TournamentDetailScreen extends StatefulWidget {
  final String tournamentId;
  final String tournamentName;
  const TournamentDetailScreen({super.key, required this.tournamentId, required this.tournamentName});
  @override
  State<TournamentDetailScreen> createState() => _TournamentDetailScreenState();
}

class _TournamentDetailScreenState extends State<TournamentDetailScreen> {
  Map<String, dynamic>? _tournament;
  Map<String, dynamic>? _myReg;
  int _participantCount = 0;
  bool _loading = true;
  bool _leaving = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    final uid = supabase.auth.currentUser?.id;
    try {
      final tFuture = supabase.from('tournaments').select('*').eq('id', widget.tournamentId).single();
      final cFuture = supabase.from('registrations').select('id').eq('tournament_id', widget.tournamentId).eq('status', 'registered');
      final rFuture = uid != null
          ? supabase.from('registrations').select('id, status').eq('tournament_id', widget.tournamentId).eq('user_id', uid).neq('status', 'cancelled').maybeSingle()
          : Future.value(null);

      final results = await Future.wait([tFuture, cFuture, rFuture]);
      if (!mounted) return;
      setState(() {
        _tournament = Map<String, dynamic>.from(results[0] as Map);
        _participantCount = (results[1] as List).length;
        final regResult = results[2];
        _myReg = regResult != null ? Map<String, dynamic>.from(regResult as Map) : null;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _leaveConfirm() async {
    final name = _tournament?['name'] as String? ?? widget.tournamentName;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Выйти из турнира?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        content: Text('Ваша регистрация на «$name» будет отменена.\nЕсли есть лист ожидания — следующий займёт место.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Отмена', style: TextStyle(color: AppColors.textMuted))),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.red, foregroundColor: Colors.white,
              minimumSize: const Size(100, 40), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            child: const Text('Выйти')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _doLeave();
  }

  Future<void> _doLeave() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _leaving = true);
    try {
      await supabase.from('registrations')
          .update({'status': 'cancelled'})
          .eq('tournament_id', widget.tournamentId)
          .eq('user_id', uid);
      // продвигаем следующего из waitlist
      try {
        final next = await supabase.from('registrations').select('id')
            .eq('tournament_id', widget.tournamentId).eq('status', 'waitlist')
            .order('created_at').limit(1).maybeSingle();
        if (next != null) {
          await supabase.from('registrations').update({'status': 'registered'}).eq('id', next['id']);
        }
      } catch (_) {}
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Вы вышли из турнира', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          backgroundColor: AppColors.greenDark, behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Ошибка: $e', style: const TextStyle(color: Colors.white)),
          backgroundColor: AppColors.redCard, behavior: SnackBarBehavior.floating));
        setState(() => _leaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.green)));

    final t = _tournament ?? {};
    final name = t['name'] as String? ?? widget.tournamentName;
    final status = t['status'] as String? ?? 'open';
    final date = _formatDate(t['date'] as String?);
    final time = _formatTime(t['start_time'] as String?);
    final location = t['location'] as String?;
    final max = t['max_participants'] as int? ?? 0;
    final duration = t['duration_minutes'] as int?;
    final courts = t['courts'] as int?;
    final waitlist = t['waitlist_enabled'] == true;

    final regStatus = _myReg?['status'] as String?;
    final isRegistered = regStatus == 'registered';
    final isWaitlist = regStatus == 'waitlist';
    final isLive = status == 'live';
    final isOpen = status == 'open';
    final canLeave = (isRegistered || isWaitlist) && (isOpen || isWaitlist);

    final statusColor = isLive ? AppColors.redCard : isOpen ? AppColors.green : AppColors.textMuted;
    final statusLabel = isLive ? 'LIVE' : isOpen ? 'Открыт' : 'Завершён';

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textDark), onPressed: () => context.go('/')),
        title: Text(name, style: const TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w800, fontSize: 16)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Статус + бейдж регистрации
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(color: statusColor.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
              child: Text(statusLabel, style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 13))),
            const SizedBox(width: 8),
            if (isRegistered)
              Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(color: AppColors.green.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                child: const Text('Вы участвуете', style: TextStyle(color: AppColors.green, fontWeight: FontWeight.w700, fontSize: 13)))
            else if (isWaitlist)
              Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(color: AppColors.blueDark.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                child: const Text('Лист ожидания', style: TextStyle(color: AppColors.blueDark, fontWeight: FontWeight.w700, fontSize: 13))),
          ]),
          const SizedBox(height: 20),
          // Карточка деталей
          Container(
            width: double.infinity, padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 3))]),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(color: AppColors.textDark, fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              _detailRow(Icons.calendar_today_rounded, 'Дата', '$date  $time'),
              if (location != null && location.isNotEmpty) _detailRow(Icons.location_on_rounded, 'Место', location),
              _detailRow(Icons.people_rounded, 'Участники', max > 0 ? '$_participantCount / $max' : '$_participantCount'),
              if (courts != null) _detailRow(Icons.sports_tennis_rounded, 'Кортов', '$courts'),
              if (duration != null) _detailRow(Icons.timer_outlined, 'Длительность матча', '$duration мин'),
              _detailRow(Icons.queue_rounded, 'Лист ожидания', waitlist ? 'Включён' : 'Выключен'),
            ]),
          ),
          const SizedBox(height: 24),
          // Кнопка смотреть матчи (live)
          if (isLive)
            ElevatedButton.icon(
              onPressed: () => context.go('/matches/${widget.tournamentId}?name=${Uri.encodeComponent(name)}'),
              icon: const Icon(Icons.sports_tennis_rounded),
              label: const Text('Смотреть матчи'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.redCard)),
          // Кнопка выхода
          if (canLeave) ...[
            if (isLive) const SizedBox(height: 12),
            SizedBox(width: double.infinity, height: 52,
              child: OutlinedButton.icon(
                onPressed: _leaving ? null : _leaveConfirm,
                icon: _leaving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.red))
                    : const Icon(Icons.exit_to_app_rounded, color: AppColors.red),
                label: Text(_leaving ? 'Выход...' : 'Выйти из турнира',
                  style: const TextStyle(color: AppColors.red, fontSize: 16, fontWeight: FontWeight.w700)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.red, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              )),
          ],
        ]),
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 18, color: AppColors.textMuted), const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: AppColors.textDark, fontSize: 15, fontWeight: FontWeight.w600)),
      ])),
    ]),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZER SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

class OrganizerScreen extends StatefulWidget {
  const OrganizerScreen({super.key});
  @override
  State<OrganizerScreen> createState() => _OrganizerScreenState();
}

class _OrganizerScreenState extends State<OrganizerScreen> {
  late Future<List<Map<String, dynamic>>> _tournamentsFuture;

  @override
  void initState() { super.initState(); _tournamentsFuture = _fetchMyTournaments(); }

  void _load() {
    final f = _fetchMyTournaments();
    if (mounted) setState(() => _tournamentsFuture = f);
  }

  Future<List<Map<String, dynamic>>> _fetchMyTournaments() async {
    final uid = supabase.auth.currentUser!.id;
    try {
      final rows = await supabase.from('tournaments').select('*').eq('organizer_id', uid).order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(rows as List);
    } on PostgrestException catch (e) {
      if (e.message.contains('column') || e.message.contains('schema cache')) {
        final rows = await supabase.from('tournaments').select('*').order('created_at', ascending: false);
        return List<Map<String, dynamic>>.from(rows as List);
      }
      rethrow;
    }
  }

  Future<void> _updateStatus(String id, String newStatus) async {
    await supabase.from('tournaments').update({'status': newStatus}).eq('id', id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textDark), onPressed: () => context.go('/')),
        title: const Text('Мои турниры', style: TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w800)),
        centerTitle: true, backgroundColor: Colors.white, elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded, color: AppColors.green, size: 28),
            onPressed: () async { await context.push('/organizer/create'); _load(); }),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _tournamentsFuture,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator(color: AppColors.green));
          if (snap.hasError)
            return Center(child: Text('Ошибка: ${snap.error}', style: const TextStyle(color: AppColors.textMuted)));
          final list = snap.data ?? [];
          if (list.isEmpty)
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.emoji_events_outlined, size: 64, color: AppColors.textMuted),
              const SizedBox(height: 16),
              const Text('Нет турниров', style: TextStyle(color: AppColors.textDark, fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              const Text('Создайте первый турнир', style: TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () async { await context.push('/organizer/create'); _load(); },
                icon: const Icon(Icons.add), label: const Text('Создать турнир'),
                style: ElevatedButton.styleFrom(minimumSize: const Size(200, 48))),
            ]));
          return RefreshIndicator(color: AppColors.green, onRefresh: () async => _load(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              itemBuilder: (ctx, i) => _OrgTournamentCard(
                tournament: list[i],
                onTap: () async { await context.push('/organizer/tournament/${list[i]['id']}'); _load(); },
                onStatusChange: (s) => _updateStatus(list[i]['id'] as String, s))));
        },
      ),
      // FIX: нижнее меню без кнопки создания
      bottomNavigationBar: _buildBottomNav(context),
    );
  }

  Widget _buildBottomNav(BuildContext context) => Container(
    height: 64,
    decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 12, offset: const Offset(0, -2))]),
    child: Row(children: [
      _navItem(context, Icons.sports_tennis_rounded, 'Матчи', () async {
        final live = await supabase.from('tournaments').select('id, name').eq('status', 'live').limit(1).maybeSingle();
        if (live != null && context.mounted) {
          context.go('/matches/${live['id']}?name=${Uri.encodeComponent(live['name'] as String? ?? '')}');
        }
      }),
      _navItem(context, Icons.emoji_events_rounded, 'Турниры', () => context.go('/')),
      _navItem(context, Icons.admin_panel_settings_rounded, 'Орг.', () {}, active: true),
      _navItem(context, Icons.person_rounded, 'Профиль', () => context.go('/profile')),
    ]),
  );

  Widget _navItem(BuildContext context, IconData icon, String label, VoidCallback onTap, {bool active = false}) =>
    Expanded(child: GestureDetector(onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        color: active ? AppColors.navActive : Colors.transparent,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          AnimatedScale(scale: active ? 1.15 : 1.0, duration: const Duration(milliseconds: 200),
            child: Icon(icon, size: 24, color: active ? const Color(0xFFFFD700) : AppColors.textMuted2)),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: active ? FontWeight.w700 : FontWeight.w400,
            color: active ? const Color(0xFFFFD700) : AppColors.textMuted2)),
          const SizedBox(height: 2),
          AnimatedContainer(duration: const Duration(milliseconds: 200),
            width: active ? 16 : 0, height: 2,
            decoration: BoxDecoration(color: const Color(0xFFFFD700), borderRadius: BorderRadius.circular(1))),
        ]))));
}

class _OrgTournamentCard extends StatelessWidget {
  final Map<String, dynamic> tournament;
  final VoidCallback onTap;
  final ValueChanged<String> onStatusChange;
  const _OrgTournamentCard({required this.tournament, required this.onTap, required this.onStatusChange});

  @override
  Widget build(BuildContext context) {
    final name = tournament['name'] as String? ?? '—';
    final status = tournament['status'] as String? ?? 'open';
    final date = _formatDate(tournament['date'] as String?);
    final location = tournament['location'] as String?;
    final courts = tournament['courts'] as int? ?? 1;
    final max = tournament['max_participants'] as int? ?? 0;

    final statusColors = { 'open': AppColors.green, 'live': AppColors.redCard, 'finished': AppColors.textMuted, 'draft': AppColors.orange };
    final statusLabels = { 'open': 'Открыт', 'live': 'LIVE', 'finished': 'Завершён', 'draft': 'Черновик' };
    final color = statusColors[status] ?? AppColors.textMuted;
    final nextStatuses = <String, String>{ 'draft': 'open', 'open': 'live', 'live': 'finished' };
    final nextLabel = <String, String>{ 'draft': 'Открыть регистрацию', 'open': 'Запустить LIVE', 'live': 'Завершить турнир' };

    return GestureDetector(onTap: onTap,
      child: Container(margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(color: AppColors.cardBg, borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2))]),
        child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(statusLabels[status] ?? status, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12))),
            const Spacer(), const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
          ]),
          const SizedBox(height: 10),
          Text(name, style: const TextStyle(color: AppColors.textDark, fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Row(children: [
            const Icon(Icons.calendar_today_rounded, size: 13, color: AppColors.textMuted), const SizedBox(width: 4),
            Text(date, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)), const SizedBox(width: 12),
            const Icon(Icons.sports_tennis_rounded, size: 13, color: AppColors.textMuted), const SizedBox(width: 4),
            Text('$courts корт.', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
            if (max > 0) ...[const SizedBox(width: 12),
              const Icon(Icons.people_rounded, size: 13, color: AppColors.textMuted), const SizedBox(width: 4),
              Text('макс. $max', style: const TextStyle(color: AppColors.textMuted, fontSize: 13))],
          ]),
          if (location != null && location.isNotEmpty) ...[const SizedBox(height: 4),
            Row(children: [const Icon(Icons.location_on_rounded, size: 13, color: AppColors.textMuted), const SizedBox(width: 4),
              Expanded(child: Text(location, style: const TextStyle(color: AppColors.textMuted, fontSize: 13), softWrap: false, overflow: TextOverflow.clip))])],
          if (nextStatuses.containsKey(status)) ...[
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, height: 38,
              child: ElevatedButton(
                onPressed: () => onStatusChange(nextStatuses[status]!),
                style: ElevatedButton.styleFrom(backgroundColor: color, minimumSize: Size.zero, padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)), elevation: 0),
                child: Text(nextLabel[status]!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)))),
          ],
        ]))));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE TOURNAMENT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

class CreateTournamentScreen extends StatefulWidget {
  const CreateTournamentScreen({super.key});
  @override
  State<CreateTournamentScreen> createState() => _CreateTournamentScreenState();
}

class _CreateTournamentScreenState extends State<CreateTournamentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _maxCtrl = TextEditingController(text: '16');
  final _courtsCtrl = TextEditingController(text: '2');
  final _durationCtrl = TextEditingController(text: '60'); // FIX: duration_minutes NOT NULL

  DateTime _date = DateTime.now().add(const Duration(days: 7));
  TimeOfDay _startTime = const TimeOfDay(hour: 10, minute: 0);
  DateTime? _deadline;
  TimeOfDay? _deadlineTime;
  bool _waitlist = false;
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose(); _locationCtrl.dispose(); _maxCtrl.dispose();
    _courtsCtrl.dispose(); _durationCtrl.dispose();
    super.dispose();
  }

  String _fmtDate(DateTime d) => '${d.day.toString().padLeft(2,'0')}.${d.month.toString().padLeft(2,'0')}.${d.year}';
  String _fmtTime(TimeOfDay t) => '${t.hour.toString().padLeft(2,'0')}:${t.minute.toString().padLeft(2,'0')}';

  Future<void> _pickDate() async {
    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
    if (d != null) setState(() => _date = d);
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: _startTime);
    if (t != null) setState(() => _startTime = t);
  }

  Future<void> _pickDeadline() async {
    final d = await showDatePicker(context: context, initialDate: _deadline ?? DateTime.now().add(const Duration(days: 3)),
      firstDate: DateTime.now(), lastDate: _date);
    if (d != null) {
      final t = await showTimePicker(context: context, initialTime: _deadlineTime ?? const TimeOfDay(hour: 23, minute: 59));
      if (t != null) setState(() { _deadline = d; _deadlineTime = t; });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isSaving = true; _error = null; });
    try {
      final uid = supabase.auth.currentUser!.id;
      final courts = int.tryParse(_courtsCtrl.text) ?? 2;
      final max = int.tryParse(_maxCtrl.text) ?? 16;
      final duration = int.tryParse(_durationCtrl.text) ?? 60;

      String? deadlineIso;
      if (_deadline != null && _deadlineTime != null) {
        deadlineIso = DateTime(_deadline!.year, _deadline!.month, _deadline!.day,
            _deadlineTime!.hour, _deadlineTime!.minute).toIso8601String();
      }

      final insertData = <String, dynamic>{
        'name': _nameCtrl.text.trim(),
        'date': _date.toIso8601String().split('T')[0],
        'start_time': '${_fmtTime(_startTime)}:00',
        'max_participants': max,
        'duration_minutes': duration, // FIX: всегда передаём
        'status': 'open',
      };
      final optionalCols = <String, dynamic>{
        'location': _locationCtrl.text.trim(),
        'waitlist_enabled': _waitlist,
        'courts': courts,
        'registration_deadline': deadlineIso,
        'organizer_id': uid,
      };
      try {
        await supabase.from('tournaments').insert({...insertData, ...optionalCols});
      } on PostgrestException catch (e) {
        if (e.message.contains('column') || e.message.contains('schema cache')) {
          try {
            await supabase.from('tournaments').insert({...insertData, 'location': _locationCtrl.text.trim(), 'waitlist_enabled': _waitlist});
          } on PostgrestException {
            await supabase.from('tournaments').insert(insertData);
          }
        } else { rethrow; }
      }
      if (mounted) context.pop();
    } on PostgrestException catch (e) { setState(() => _error = 'Ошибка: ${e.message}'); }
    catch (e) { setState(() => _error = 'Ошибка: $e'); }
    finally { if (mounted) setState(() => _isSaving = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textDark), onPressed: () => context.pop()),
        title: const Text('Новый турнир', style: TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w800)),
        centerTitle: true, backgroundColor: Colors.white, elevation: 0),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 520),
          child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const _FieldLabel('Название турнира'), const SizedBox(height: 8),
            TextFormField(controller: _nameCtrl, style: const TextStyle(color: AppColors.textDark),
              decoration: const InputDecoration(hintText: 'Padel Cup Winter 2025'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Обязательное поле' : null),
            const SizedBox(height: 16),
            const _FieldLabel('Локация'), const SizedBox(height: 8),
            TextFormField(controller: _locationCtrl, style: const TextStyle(color: AppColors.textDark),
              decoration: const InputDecoration(hintText: 'Padel Arena, Рига')),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const _FieldLabel('Дата'), const SizedBox(height: 8),
                GestureDetector(onTap: _pickDate, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(color: AppColors.surfaceVar, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                  child: Row(children: [const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.textMuted), const SizedBox(width: 8),
                    Text(_fmtDate(_date), style: const TextStyle(color: AppColors.textDark, fontSize: 15))]))),
              ])),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const _FieldLabel('Время начала'), const SizedBox(height: 8),
                GestureDetector(onTap: _pickTime, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(color: AppColors.surfaceVar, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                  child: Row(children: [const Icon(Icons.access_time_rounded, size: 16, color: AppColors.textMuted), const SizedBox(width: 8),
                    Text(_fmtTime(_startTime), style: const TextStyle(color: AppColors.textDark, fontSize: 15))]))),
              ])),
            ]),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const _FieldLabel('Кол-во кортов'), const SizedBox(height: 8),
                TextFormField(controller: _courtsCtrl, keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(color: AppColors.textDark), decoration: const InputDecoration(hintText: '2'),
                  validator: (v) { final n = int.tryParse(v ?? ''); return (n == null || n < 1) ? 'Мин. 1' : null; }),
              ])),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const _FieldLabel('Макс. участников'), const SizedBox(height: 8),
                TextFormField(controller: _maxCtrl, keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(color: AppColors.textDark), decoration: const InputDecoration(hintText: '16'),
                  validator: (v) { final n = int.tryParse(v ?? ''); return (n == null || n < 2) ? 'Мин. 2' : null; }),
              ])),
            ]),
            const SizedBox(height: 16),
            const _FieldLabel('Длительность матча (мин)'), const SizedBox(height: 8),
            TextFormField(controller: _durationCtrl, keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(color: AppColors.textDark), decoration: const InputDecoration(hintText: '60'),
              validator: (v) { final n = int.tryParse(v ?? ''); return (n == null || n < 5) ? 'Мин. 5 мин' : null; }),
            const SizedBox(height: 16),
            const _FieldLabel('Дедлайн регистрации'), const SizedBox(height: 8),
            GestureDetector(onTap: _pickDeadline, child: Container(width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(color: AppColors.surfaceVar, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
              child: Row(children: [const Icon(Icons.event_busy_rounded, size: 16, color: AppColors.textMuted), const SizedBox(width: 8),
                Text(_deadline == null ? 'Выбрать дату и время' : '${_fmtDate(_deadline!)} ${_fmtTime(_deadlineTime!)}',
                  style: TextStyle(color: _deadline == null ? AppColors.textMuted : AppColors.textDark, fontSize: 15))]))),
            const SizedBox(height: 16),
            Row(children: [
              Switch(value: _waitlist, onChanged: (v) => setState(() => _waitlist = v), activeColor: AppColors.green),
              const SizedBox(width: 8),
              const Text('Лист ожидания', style: TextStyle(color: AppColors.textDark, fontSize: 15, fontWeight: FontWeight.w600)),
            ]),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.red.withOpacity(0.3))),
                child: Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 13))),
            ],
            const SizedBox(height: 28),
            ElevatedButton(onPressed: _isSaving ? null : _save,
              child: _isSaving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Создать турнир')),
            const SizedBox(height: 32),
          ]))),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZER TOURNAMENT DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

class OrganizerTournamentScreen extends StatefulWidget {
  final String tournamentId;
  const OrganizerTournamentScreen({super.key, required this.tournamentId});
  @override
  State<OrganizerTournamentScreen> createState() => _OrganizerTournamentScreenState();
}

class _OrganizerTournamentScreenState extends State<OrganizerTournamentScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _tournament;
  List<Map<String, dynamic>> _registrations = [];
  List<Map<String, dynamic>> _pairs = [];
  List<Map<String, dynamic>> _matches = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadAll();
  }

  @override
  void dispose() { _tabController.dispose(); super.dispose(); }

  Future<void> _loadAll() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait<dynamic>([
        supabase.from('tournaments').select('*').eq('id', widget.tournamentId).single(),
        supabase.from('registrations').select('*, profiles(id, first_name, last_name)').eq('tournament_id', widget.tournamentId).neq('status', 'cancelled'),
        supabase.from('pairs').select('id, player1_id, player2_id, games_played, games_won, points').eq('tournament_id', widget.tournamentId),
        supabase.from('matches').select('*').eq('tournament_id', widget.tournamentId).order('scheduled_time', ascending: true),
      ]);
      final tournament = Map<String, dynamic>.from(results[0] as Map);
      final registrations = List<Map<String, dynamic>>.from(results[1] as List);
      var pairs = List<Map<String, dynamic>>.from(results[2] as List);
      final matches = List<Map<String, dynamic>>.from(results[3] as List);
      if (pairs.isNotEmpty) {
        final ids = <String>{};
        for (final p in pairs) { if (p['player1_id'] != null) ids.add(p['player1_id'] as String); if (p['player2_id'] != null) ids.add(p['player2_id'] as String); }
        final profiles = await _fetchProfiles(ids);
        pairs = pairs.map((p) => {...p, 'p1': profiles[p['player1_id']], 'p2': profiles[p['player2_id']]}).toList();
      }
      if (mounted) setState(() { _loading = false; _tournament = tournament; _registrations = registrations; _pairs = pairs; _matches = matches; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = '$e'; });
    }
  }

  Future<void> _generatePairs() async {
    final registered = _registrations.where((r) => r['status'] == 'registered').toList();
    if (registered.length < 2) { _showSnack('Нужно минимум 2 зарегистрированных участника', isError: true); return; }
    final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Сформировать пары?'),
      content: Text('${registered.length} участников → ${registered.length ~/ 2} пар.\nСуществующие пары и матчи будут удалены.'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
        ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Сформировать'))],
    ));
    if (confirm != true) return;
    try {
      await supabase.from('matches').delete().eq('tournament_id', widget.tournamentId);
      await supabase.from('pairs').delete().eq('tournament_id', widget.tournamentId);
      final shuffled = List.from(registered)..shuffle(Random());
      final newPairs = <Map<String, dynamic>>[];
      for (int i = 0; i + 1 < shuffled.length; i += 2) {
        newPairs.add({'tournament_id': widget.tournamentId, 'player1_id': shuffled[i]['user_id'], 'player2_id': shuffled[i+1]['user_id'], 'games_played': 0, 'games_won': 0, 'points': 0});
      }
      await supabase.from('pairs').insert(newPairs);
      _showSnack('Пары сформированы: ${newPairs.length}');
      await _loadAll();
    } catch (e) { _showSnack('Ошибка: $e', isError: true); }
  }

  Future<void> _generateSchedule() async {
    if (_pairs.isEmpty) { _showSnack('Сначала сформируйте пары', isError: true); return; }
    final courts = (_tournament?['courts'] as int?) ?? 1;
    final startTimeStr = _tournament?['start_time'] as String? ?? '10:00:00';
    final dateStr = _tournament?['date'] as String? ?? DateTime.now().toIso8601String().split('T')[0];
    final baseStart = DateTime.parse('${dateStr}T${startTimeStr.length == 5 ? '$startTimeStr:00' : startTimeStr}');
    final pairIds = _pairs.map((p) => p['id'] as String).toList();
    final schedule = <List<String>>[];
    final ids = List<String>.from(pairIds);
    if (ids.length % 2 != 0) ids.add('BYE');
    final half = ids.length ~/ 2;
    for (int round = 0; round < ids.length - 1; round++) {
      for (int i = 0; i < half; i++) {
        final a = ids[i]; final b = ids[ids.length - 1 - i];
        if (a != 'BYE' && b != 'BYE') schedule.add([a, b]);
      }
      final last = ids.removeLast(); ids.insert(1, last);
    }
    final duration = (_tournament?['duration_minutes'] as int?) ?? 60;
    final slotMinutes = max(15, duration);
    final matchInserts = <Map<String, dynamic>>[];
    for (int i = 0; i < schedule.length; i++) {
      matchInserts.add({
        'tournament_id': widget.tournamentId,
        'pair1_id': schedule[i][0], 'pair2_id': schedule[i][1],
        'court_number': (i % courts) + 1,
        'scheduled_time': baseStart.add(Duration(minutes: (i ~/ courts) * slotMinutes)).toUtc().toIso8601String(),
        'status': 'waiting',
      });
    }
    final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Сгенерировать расписание?'),
      content: Text('${matchInserts.length} матчей, $courts корт(а), слот ~$slotMinutes мин.\nСуществующие матчи будут удалены.'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
        ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Генерировать'))],
    ));
    if (confirm != true) return;
    try {
      await supabase.from('matches').delete().eq('tournament_id', widget.tournamentId);
      await supabase.from('matches').insert(matchInserts);
      _showSnack('Расписание создано: ${matchInserts.length} матчей');
      await _loadAll();
    } catch (e) { _showSnack('Ошибка: $e', isError: true); }
  }

  Future<void> _syncMatchStatuses() async {
    if (_matches.isEmpty) return;
    final slotMin = (_tournament?['duration_minutes'] as int?) ?? 60;
    final now = DateTime.now().toUtc();
    final toUpdate = <Map<String, dynamic>>[];
    for (final m in _matches) {
      final st = m['scheduled_time'] as String?; if (st == null) continue;
      final scheduled = DateTime.parse(st).toUtc();
      final end = scheduled.add(Duration(minutes: slotMin));
      final currentStatus = m['status'] as String? ?? 'waiting';
      String? newStatus;
      if (now.isAfter(end) && currentStatus != 'done' && currentStatus != 'live') newStatus = 'done';
      else if (now.isAfter(scheduled) && now.isBefore(end) && currentStatus == 'waiting') newStatus = 'live';
      if (newStatus != null) toUpdate.add({'id': m['id'], 'status': newStatus});
    }
    if (toUpdate.isNotEmpty) {
      for (final u in toUpdate) { await supabase.from('matches').update({'status': u['status']}).eq('id', u['id']); }
      await _loadAll(); _showSnack('Статусы обновлены (${toUpdate.length})');
    } else { _showSnack('Все статусы актуальны'); }
  }

  Future<void> _setMatchStatus(String matchId, String status) async {
    await supabase.from('matches').update({'status': status}).eq('id', matchId);
    await _loadAll();
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      backgroundColor: isError ? AppColors.redCard : AppColors.greenDark, behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.green)));
    if (_error != null) return Scaffold(body: Center(child: Text('Ошибка: $_error')));
    final name = _tournament?['name'] as String? ?? '—';
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textDark), onPressed: () => context.pop()),
        title: Text(name, style: const TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w800, fontSize: 16)),
        centerTitle: true, backgroundColor: Colors.white, elevation: 0,
        bottom: TabBar(controller: _tabController, indicatorColor: AppColors.green, indicatorWeight: 3,
          labelColor: AppColors.green, unselectedLabelColor: AppColors.textMuted,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
          tabs: const [Tab(text: 'УЧАСТНИКИ'), Tab(text: 'ПАРЫ'), Tab(text: 'МАТЧИ')]),
      ),
      body: TabBarView(controller: _tabController, children: [_buildParticipantsTab(), _buildPairsTab(), _buildMatchesTab()]),
    );
  }

  Widget _buildParticipantsTab() {
    final registered = _registrations.where((r) => r['status'] == 'registered').toList();
    final waitlist = _registrations.where((r) => r['status'] == 'waitlist').toList();
    return RefreshIndicator(color: AppColors.green, onRefresh: _loadAll, child: ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Expanded(child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: AppColors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: Column(children: [Text('${registered.length}', style: const TextStyle(color: AppColors.green, fontSize: 24, fontWeight: FontWeight.w800)), const Text('Зарег.', style: TextStyle(color: AppColors.green, fontSize: 12))]))),
        const SizedBox(width: 12),
        Expanded(child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: AppColors.blueDark.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: Column(children: [Text('${waitlist.length}', style: const TextStyle(color: AppColors.blueDark, fontSize: 24, fontWeight: FontWeight.w800)), const Text('Waitlist', style: TextStyle(color: AppColors.blueDark, fontSize: 12))]))),
      ]),
      const SizedBox(height: 16),
      ElevatedButton.icon(onPressed: _generatePairs, icon: const Icon(Icons.shuffle_rounded), label: const Text('Сформировать пары рандомно'),
        style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 48))),
      const SizedBox(height: 16),
      if (registered.isNotEmpty) ...[
        const Text('Зарегистрированы', style: TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 8),
        ...registered.map((r) => _participantTile(r, AppColors.green)),
      ],
      if (waitlist.isNotEmpty) ...[
        const SizedBox(height: 12),
        const Text('Лист ожидания', style: TextStyle(color: AppColors.blueDark, fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 8),
        ...waitlist.map((r) => _participantTile(r, AppColors.blueDark)),
      ],
    ]));
  }

  Widget _participantTile(Map<String, dynamic> reg, Color color) {
    final profile = reg['profiles'] as Map?;
    final first = profile?['first_name'] as String? ?? '';
    final last = profile?['last_name'] as String? ?? '';
    final name = '$first $last'.trim().isEmpty ? 'Участник' : '$first $last'.trim();
    return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        CircleAvatar(backgroundColor: color.withOpacity(0.12), radius: 18, child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: TextStyle(color: color, fontWeight: FontWeight.w700))),
        const SizedBox(width: 12),
        Expanded(child: Text(name, style: const TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w600))),
        Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
          child: Text(reg['status'] as String? ?? '', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700))),
      ]));
  }

  Widget _buildPairsTab() {
    return RefreshIndicator(color: AppColors.green, onRefresh: _loadAll, child: ListView(padding: const EdgeInsets.all(16), children: [
      if (_pairs.isEmpty)
        Center(child: Padding(padding: const EdgeInsets.only(top: 48), child: Column(children: [
          const Icon(Icons.group_outlined, size: 48, color: AppColors.textMuted), const SizedBox(height: 12),
          const Text('Пары ещё не сформированы', style: TextStyle(color: AppColors.textMuted)), const SizedBox(height: 16),
          ElevatedButton.icon(onPressed: _generatePairs, icon: const Icon(Icons.shuffle_rounded), label: const Text('Сформировать'), style: ElevatedButton.styleFrom(minimumSize: const Size(200, 44))),
        ])))
      else ...[
        Row(children: [
          Text('${_pairs.length} пар', style: const TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w700, fontSize: 15)),
          const Spacer(),
          TextButton.icon(onPressed: _generatePairs, icon: const Icon(Icons.refresh_rounded, size: 16), label: const Text('Переформировать'), style: TextButton.styleFrom(foregroundColor: AppColors.orange)),
        ]),
        const SizedBox(height: 8),
        ..._pairs.asMap().entries.map((e) {
          final i = e.key; final p = e.value;
          return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              Container(width: 28, height: 28, decoration: BoxDecoration(color: AppColors.green.withOpacity(0.12), shape: BoxShape.circle),
                child: Center(child: Text('${i+1}', style: const TextStyle(color: AppColors.green, fontWeight: FontWeight.w800, fontSize: 13)))),
              const SizedBox(width: 12),
              Expanded(child: Text(_pairName(p), style: const TextStyle(color: AppColors.textDark, fontWeight: FontWeight.w600))),
            ]));
        }),
      ],
    ]));
  }

  Widget _buildMatchesTab() {
    return RefreshIndicator(color: AppColors.green, onRefresh: _loadAll, child: ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Expanded(child: ElevatedButton.icon(onPressed: _generateSchedule, icon: const Icon(Icons.calendar_month_rounded, size: 18), label: const Text('Генерировать'),
          style: ElevatedButton.styleFrom(minimumSize: const Size(0, 44), textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)))),
        const SizedBox(width: 10),
        Expanded(child: ElevatedButton.icon(onPressed: _syncMatchStatuses, icon: const Icon(Icons.sync_rounded, size: 18), label: const Text('Синх. статусы'),
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.blueDark, minimumSize: const Size(0, 44), textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)))),
      ]),
      const SizedBox(height: 16),
      if (_matches.isEmpty)
        Center(child: Padding(padding: const EdgeInsets.only(top: 32), child: Column(children: [
          const Icon(Icons.sports_tennis_rounded, size: 48, color: AppColors.textMuted), const SizedBox(height: 12),
          const Text('Матчи не созданы', style: TextStyle(color: AppColors.textMuted)), const SizedBox(height: 4),
          const Text('Сначала сформируйте пары,\nзатем генерируйте расписание', style: TextStyle(color: AppColors.textMuted, fontSize: 12), textAlign: TextAlign.center),
        ])))
      else
        ..._matches.map((m) => _OrgMatchTile(match: m, onStatusChange: (s) => _setMatchStatus(m['id'] as String, s))),
    ]));
  }
}

class _OrgMatchTile extends StatelessWidget {
  final Map<String, dynamic> match;
  final ValueChanged<String> onStatusChange;
  const _OrgMatchTile({required this.match, required this.onStatusChange});

  @override
  Widget build(BuildContext context) {
    final status = match['status'] as String? ?? 'waiting';
    final court = match['court_number'] as int?;
    final time = match['scheduled_time'] as String?;
    String timeStr = '—';
    if (time != null) {
      try { final dt = DateTime.parse(time).toLocal(); timeStr = '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}'; } catch (_) {}
    }
    final statusColor = status == 'live' ? AppColors.redCard : status == 'done' ? AppColors.green : AppColors.textMuted;
    final statusLabel = status == 'live' ? 'LIVE' : status == 'done' ? 'DONE' : 'WAIT';
    return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0,1))]),
      child: Row(children: [
        Container(width: 42, padding: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(color: statusColor.withOpacity(0.12), borderRadius: BorderRadius.circular(6)),
          child: Text(statusLabel, textAlign: TextAlign.center, style: TextStyle(color: statusColor, fontWeight: FontWeight.w800, fontSize: 11))),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            if (court != null) ...[const Icon(Icons.sports_tennis_rounded, size: 12, color: AppColors.textMuted), const SizedBox(width: 3),
              Text('Корт $court', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)), const SizedBox(width: 8)],
            const Icon(Icons.access_time_rounded, size: 12, color: AppColors.textMuted), const SizedBox(width: 3),
            Text(timeStr, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ]),
          const SizedBox(height: 2),
          Text('Матч #${(match['id'] as String).substring(0,6)}', style: const TextStyle(color: AppColors.textDark, fontSize: 12, fontWeight: FontWeight.w600)),
        ])),
        PopupMenuButton<String>(onSelected: onStatusChange,
          itemBuilder: (_) => [
            if (status != 'waiting') const PopupMenuItem(value: 'waiting', child: Text('→ Waiting')),
            if (status != 'live') const PopupMenuItem(value: 'live', child: Text('→ Live')),
            if (status != 'done') const PopupMenuItem(value: 'done', child: Text('→ Done')),
          ],
          icon: const Icon(Icons.more_vert_rounded, color: AppColors.textMuted, size: 20)),
      ]));
  }
}

// ─── Supporting Widgets ───────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
    style: const TextStyle(color: Color(0xFF7A90A8), fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.3));
}

class _VisibilityToggle extends StatelessWidget {
  final bool visible;
  final VoidCallback onToggle;
  const _VisibilityToggle({required this.visible, required this.onToggle});
  @override
  Widget build(BuildContext context) => IconButton(
    icon: Icon(visible ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: const Color(0xFF7A90A8), size: 20),
    onPressed: onToggle);
}

class _BackgroundDecoration extends StatelessWidget {
  const _BackgroundDecoration();
  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Stack(children: [
      Positioned(top: -80, right: -80, child: Container(width: 280, height: 280,
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [const Color(0xFF2D9B4F).withOpacity(0.08), Colors.transparent])))),
      Positioned(bottom: size.height * 0.1, left: -60, child: Container(width: 200, height: 200,
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [const Color(0xFF6366F1).withOpacity(0.07), Colors.transparent])))),
    ]);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

String _formatDate(String? dateStr) {
  if (dateStr == null) return '';
  try {
    final d = DateTime.parse(dateStr);
    const months = ['','янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    return '${d.day} ${months[d.month]}';
  } catch (_) { return dateStr; }
}

String _formatTime(String? timeStr) {
  if (timeStr == null) return '';
  return timeStr.substring(0, 5);
}

String _pairName(Map? pair) {
  if (pair == null) return '—';
  String playerName(Map? profile, String? fallbackId) {
    if (profile != null) {
      final last = (profile['last_name'] as String? ?? '').trim();
      final first = (profile['first_name'] as String? ?? '').trim();
      if (last.isNotEmpty) return last;
      if (first.isNotEmpty) return first;
    }
    if (fallbackId != null && fallbackId.length >= 4) return '#${fallbackId.substring(0, 4)}';
    return '?';
  }
  final n1 = playerName(pair['p1'] as Map?, pair['player1_id'] as String?);
  final n2 = playerName(pair['p2'] as Map?, pair['player2_id'] as String?);
  return '$n1 / $n2';
}

// ─── Home Screen ─────────────────────────────────────────────────────────────

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _navIndex = 1;
  String? _myRole;

  static const _blue = AppColors.blue;
  static const _blueDark = AppColors.blueDark;
  static const _textDark = AppColors.textDark2;
  static const _textMuted = AppColors.textMuted2;
  static const _cardBg = AppColors.cardBg;
  static const _liveRed = AppColors.redCard;
  static const _greenDark = AppColors.greenDark;

  late Future<Map<String, dynamic>> _dataFuture;

  @override
  void initState() {
    super.initState();
    _dataFuture = _loadAll();
    _loadRole();
  }

  Future<void> _loadRole() async {
    final role = await _getMyRole();
    if (mounted) setState(() => _myRole = role);
  }

  // FIX: _refresh не использует setState с async — только синхронный setState
  void _refresh() => setState(() { _dataFuture = _loadAll(); });

  Future<Map<String, dynamic>> _loadAll() async {
    final uid = supabase.auth.currentUser!.id;
    final results = await Future.wait<dynamic>([
      supabase.from('registrations')
          .select('id, status, tournament_id, tournaments(id, name, date, start_time, status, location, max_participants, waitlist_enabled, duration_minutes)')
          .eq('user_id', uid)
          .neq('status', 'cancelled')
          .limit(30),
      supabase.from('tournaments')
          .select('id, name, date, start_time, status, location, max_participants, waitlist_enabled')
          .inFilter('status', ['open', 'live'])
          .order('date', ascending: true)
          .limit(50),
      supabase.from('registrations')
          .select('tournament_id, status')
          .eq('status', 'registered')
          .limit(500),
      supabase.from('tournaments')
          .select('id')
          .eq('status', 'finished')
          .limit(1),
    ]);

    final myRegs = results[0] as List;
    final available = results[1] as List;
    final allRegs = results[2] as List;
    final finishedList = results[3] as List;

    final myTournamentIds = myRegs.map((r) => r['tournament_id'] as String).toList();

    final Map<String, int> participantCounts = {};
    for (final r in allRegs) {
      final tid = r['tournament_id'] as String;
      participantCounts[tid] = (participantCounts[tid] ?? 0) + 1;
    }

    final sortedMyRegs = List.from(myRegs);
    sortedMyRegs.sort((a, b) {
      int priority(Map r) {
        final s = r['tournaments']?['status'] ?? '';
        if (s == 'live') return 0;
        if (r['status'] == 'registered') return 1;
        return 2;
      }
      return priority(a).compareTo(priority(b));
    });

    bool liveSeen = false;
    final deduped = <dynamic>[];
    for (final reg in sortedMyRegs) {
      final tStatus = reg['tournaments']?['status'] ?? '';
      if (tStatus == 'live') { if (liveSeen) continue; liveSeen = true; }
      deduped.add(reg);
    }

    int finishedCount = 0;
    if (finishedList.isNotEmpty) {
      try {
        finishedCount = (await supabase.from('tournaments').select('id').eq('status', 'finished') as List).length;
      } catch (_) { finishedCount = 1; }
    }

    return {
      'myRegs': deduped,
      'available': available,
      'participantCounts': participantCounts,
      'myTournamentIds': myTournamentIds,
      'finishedCount': finishedCount,
    };
  }

  Future<void> _register(Map tournament, Map<String, int> counts) async {
    final uid = supabase.auth.currentUser!.id;
    final tid = tournament['id'] as String;
    final max = tournament['max_participants'] as int? ?? 0;
    final current = counts[tid] ?? 0;
    final isFull = max > 0 && current >= max;
    final waitlistEnabled = tournament['waitlist_enabled'] == true;
    if (isFull && !waitlistEnabled) { _showSnack('Турнир заполнен и лист ожидания закрыт', isError: true); return; }
    HapticFeedback.lightImpact();
    try {
      await supabase.from('registrations').insert({'tournament_id': tid, 'user_id': uid, 'status': isFull ? 'waitlist' : 'registered'});
      _showSnack(isFull ? 'Вы в листе ожидания' : 'Вы зарегистрированы!');
      _refresh();
    } on PostgrestException catch (e) {
      if (e.code == '23505') { _showSnack('Вы уже зарегистрированы на этот турнир', isError: true); }
      else { _showSnack('Ошибка: ${e.message}', isError: true); }
    } catch (_) { _showSnack('Ошибка регистрации', isError: true); }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      backgroundColor: isError ? AppColors.redCard : AppColors.greenDark,
      behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
  }

  Future<void> _navigateToMatches(BuildContext context) async {
    final uid = supabase.auth.currentUser!.id;
    try {
      final myLive = await supabase.from('registrations')
          .select('tournament_id, tournaments(id, name, status)')
          .eq('user_id', uid).eq('status', 'registered').limit(20);
      for (final r in myLive as List) {
        final t = r['tournaments'];
        if (t != null && t['status'] == 'live') {
          if (context.mounted) context.go('/matches/${t['id']}?name=${Uri.encodeComponent(t['name'] as String? ?? 'Турнир')}');
          return;
        }
      }
      final live = await supabase.from('tournaments').select('id, name').eq('status', 'live').limit(1).maybeSingle();
      if (live != null && context.mounted) {
        context.go('/matches/${live['id']}?name=${Uri.encodeComponent(live['name'] as String? ?? 'Турнир')}');
      } else { _showSnack('Нет активных турниров'); }
    } catch (_) { _showSnack('Ошибка загрузки турниров', isError: true); }
  }

  bool get _isOrganizer => _myRole == 'organizer';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(children: [
        Positioned.fill(child: Container(decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF87CEEB), Color(0xFFB8E4C9), Color(0xFF7FB3D3)])))),
        Positioned.fill(child: Container(color: Colors.white.withOpacity(0.25))),
        SafeArea(child: FutureBuilder<Map<String, dynamic>>(
          future: _dataFuture,
          builder: (context, snap) => RefreshIndicator(color: AppColors.greenDark, onRefresh: () async => _refresh(),
            child: CustomScrollView(slivers: [
              SliverToBoxAdapter(child: _buildAppBar()),
              if (snap.connectionState == ConnectionState.waiting)
                const SliverFillRemaining(child: Center(child: CircularProgressIndicator(color: Color(0xFF27AE60))))
              else if (snap.hasError)
                SliverFillRemaining(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.error_outline, color: Color(0xFFE74C3C), size: 48), const SizedBox(height: 12),
                  Text('Ошибка загрузки', style: TextStyle(color: _textDark)),
                  TextButton(onPressed: _refresh, child: const Text('Повторить', style: TextStyle(color: Color(0xFF27AE60)))),
                ])))
              else ...[
                SliverToBoxAdapter(child: _buildAvailable(snap.data!)),
                SliverToBoxAdapter(child: _buildMyTournaments(snap.data!)),
                SliverToBoxAdapter(child: _buildFinished(snap.data!)),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            ])),
        )),
      ]),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  // FIX: убрана иконка профиля
  Widget _buildAppBar() => Padding(
    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
    child: const Text('Padel Cup',
      style: TextStyle(color: AppColors.textDark, fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
  );

  Widget _buildAvailable(Map<String, dynamic> data) {
    final available = data['available'] as List;
    final counts = data['participantCounts'] as Map<String, int>;
    final myIds = data['myTournamentIds'] as List<String>;
    final filtered = available.where((t) => !myIds.contains(t['id'])).toList();
    return Padding(padding: const EdgeInsets.fromLTRB(16, 20, 16, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Text('Доступные турниры', style: TextStyle(color: _textDark, fontSize: 20, fontWeight: FontWeight.w700)),
        const Spacer(),
        // FIX: кнопка "+ Все" вместо просто "Все >"
        GestureDetector(
          onTap: () => _showAllTournaments(context, data),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: _blue.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.add_rounded, size: 16, color: _blue),
              SizedBox(width: 4),
              Text('Все', style: TextStyle(color: _blue, fontSize: 14, fontWeight: FontWeight.w600)),
            ]),
          )),
      ]),
      const SizedBox(height: 12),
      if (filtered.isEmpty)
        Container(width: double.infinity, padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(16)),
          child: const Text('Нет доступных турниров', textAlign: TextAlign.center, style: TextStyle(color: _textMuted, fontSize: 15)))
      else
        SizedBox(height: 190, child: PageView.builder(
          itemCount: filtered.length, controller: PageController(viewportFraction: 0.85),
          itemBuilder: (ctx, i) {
            final t = filtered[i] as Map; final current = counts[t['id']] ?? 0;
            final isFull = (t['max_participants'] as int? ?? 0) > 0 && current >= (t['max_participants'] as int);
            final isLive = t['status'] == 'live';
            return Padding(padding: const EdgeInsets.only(right: 12), child: _AvailableCard(
              tournament: t, current: current, isFull: isFull, isLive: isLive,
              onRegister: () => _register(t, counts),
              onLiveTap: () => context.go('/matches/${t['id']}?name=${Uri.encodeComponent(t['name'] as String? ?? 'Турнир')}')));
          })),
    ]));
  }

  void _showAllTournaments(BuildContext context, Map<String, dynamic> data) {
    final available = data['available'] as List;
    final counts = data['participantCounts'] as Map<String, int>;
    final myIds = data['myTournamentIds'] as List<String>;
    final filtered = available.where((t) => !myIds.contains(t['id'])).toList();
    showModalBottomSheet(
      context: context, isScrollControlled: true, isDismissible: true, enableDrag: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => SafeArea(child: Container(
        height: MediaQuery.of(sheetCtx).size.height * 0.85,
        decoration: const BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(children: [
          const SizedBox(height: 8),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          Padding(padding: const EdgeInsets.fromLTRB(16, 8, 8, 4), child: Row(children: [
            const Text("Все турниры", style: TextStyle(color: AppColors.textDark, fontSize: 18, fontWeight: FontWeight.w700)),
            const Spacer(),
            IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textMuted), onPressed: () => Navigator.of(sheetCtx).pop()),
          ])),
          Expanded(child: filtered.isEmpty
            ? const Center(child: Text("Нет доступных турниров", style: TextStyle(color: AppColors.textMuted)))
            : ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: filtered.length,
                itemBuilder: (_, i) {
                  final t = filtered[i] as Map;
                  final current = counts[t['id']] ?? 0;
                  final isFull = (t['max_participants'] as int? ?? 0) > 0 && current >= (t['max_participants'] as int);
                  final isLive = t['status'] == 'live';
                  return Padding(padding: const EdgeInsets.only(bottom: 12),
                    child: SizedBox(height: 190, child: _AvailableCard(
                      tournament: t, current: current, isFull: isFull, isLive: isLive,
                      onRegister: () async {
                        await _register(t, counts);
                        if (sheetCtx.mounted) Navigator.of(sheetCtx).pop();
                        _refresh();
                      },
                      onLiveTap: () {
                        Navigator.of(sheetCtx).pop();
                        context.go('/matches/${t['id']}?name=${Uri.encodeComponent(t['name'] as String? ?? 'Турнир')}');
                      },
                    )));
                })),
        ]),
      )),
    );
  }

  Widget _buildMyTournaments(Map<String, dynamic> data) {
    final myRegs = data['myRegs'] as List;
    final counts = data['participantCounts'] as Map<String, int>;
    return Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Мои турниры', style: TextStyle(color: _textDark, fontSize: 20, fontWeight: FontWeight.w700)),
      const SizedBox(height: 12),
      if (myRegs.isEmpty)
        Container(width: double.infinity, padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(16)),
          child: const Text('Вы ещё не зарегистрированы ни в одном турнире', textAlign: TextAlign.center, style: TextStyle(color: _textMuted, fontSize: 15)))
      else
        _buildMyRegsList(myRegs, counts),
    ]));
  }

  Widget _buildMyRegsList(List myRegs, Map<String, int> counts) {
    final liveRegs = myRegs.where((r) => (r['tournaments']?['status'] ?? '') == 'live').toList();
    final otherRegs = myRegs.where((r) => (r['tournaments']?['status'] ?? '') != 'live').toList();
    return Column(children: [
      for (final reg in liveRegs) ...[_buildLiveCard(reg), const SizedBox(height: 10)],
      if (otherRegs.isNotEmpty) _buildOtherRegsGrid(otherRegs, counts),
    ]);
  }

  Widget _buildLiveCard(Map reg) {
    final t = reg['tournaments'] as Map? ?? {};
    final name = t['name'] as String? ?? '—';
    final date = _formatDate(t['date'] as String?);
    final time = _formatTime(t['start_time'] as String?);
    final duration = t['duration_minutes'] as int?;
    final location = t['location'] as String?;
    final tid = t['id'] as String? ?? '';
    return GestureDetector(
      onTap: () { if (tid.isNotEmpty) context.go('/matches/$tid?name=${Uri.encodeComponent(name)}'); },
      child: Container(width: double.infinity, padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _liveRed.withOpacity(0.3), width: 1),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 6, offset: const Offset(0, 2))]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: _liveRed, borderRadius: BorderRadius.circular(6)),
              child: const Text('LIVE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1.5))),
            const Spacer(), const Icon(Icons.chevron_right_rounded, color: _textMuted)]),
          const SizedBox(height: 10),
          Text(name, style: const TextStyle(color: _textDark, fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Row(children: [
            const Icon(Icons.calendar_today_rounded, size: 14, color: _textMuted), const SizedBox(width: 4),
            Text(date, style: const TextStyle(color: _textMuted, fontSize: 14)), const SizedBox(width: 12),
            const Icon(Icons.access_time_rounded, size: 14, color: _textMuted), const SizedBox(width: 4),
            Text(time, style: const TextStyle(color: _textMuted, fontSize: 14)),
            if (duration != null) ...[const SizedBox(width: 12), const Icon(Icons.timer_outlined, size: 14, color: _textMuted), const SizedBox(width: 4),
              Text('$duration мин', style: const TextStyle(color: _textMuted, fontSize: 14))]]),
          if (location != null && location.isNotEmpty) ...[const SizedBox(height: 4),
            Row(children: [const Icon(Icons.location_on_rounded, size: 14, color: _textMuted), const SizedBox(width: 4),
              Expanded(child: Text(location, style: const TextStyle(color: _textMuted, fontSize: 13), softWrap: false, overflow: TextOverflow.clip))])],
        ])));
  }

  Widget _buildOtherRegsGrid(List regs, Map<String, int> counts) {
    final rows = <Widget>[];
    for (int i = 0; i < regs.length; i += 2) {
      final a = regs[i] as Map; final b = i + 1 < regs.length ? regs[i + 1] as Map : null;
      rows.add(Row(children: [
        Expanded(child: _buildSmallMyCard(a, counts)),
        const SizedBox(width: 10),
        Expanded(child: b != null ? _buildSmallMyCard(b, counts) : const SizedBox()),
      ]));
      if (i + 2 < regs.length) rows.add(const SizedBox(height: 10));
    }
    return Column(children: rows);
  }

  // FIX: нет кнопки выхода в карточке — только переход на TournamentDetailScreen
  Widget _buildSmallMyCard(Map reg, Map<String, int> counts) {
    final t = reg['tournaments'] as Map? ?? {};
    final regStatus = reg['status'] as String? ?? '';
    final tStatus = t['status'] as String? ?? '';
    final tid = t['id'] as String? ?? '';
    final name = t['name'] as String? ?? '—';
    final date = _formatDate(t['date'] as String?);
    final max = t['max_participants'] as int? ?? 0;
    final current = counts[tid] ?? 0;
    final location = t['location'] as String?;
    final isWaitlist = regStatus == 'waitlist';
    final isLive = tStatus == 'live';

    Color badgeColor;
    String badgeLabel;
    if (isLive) { badgeColor = _liveRed; badgeLabel = 'LIVE'; }
    else if (isWaitlist) { badgeColor = _blueDark; badgeLabel = 'Waitlist'; }
    else { badgeColor = _greenDark; badgeLabel = 'Registered'; }

    return GestureDetector(
      onTap: () {
        if (tid.isEmpty) return;
        if (isLive) {
          context.go('/matches/$tid?name=${Uri.encodeComponent(name)}');
        } else {
          // FIX: переход в детальный экран, refresh после возврата
          context.push('/tournament/$tid?name=${Uri.encodeComponent(name)}').then((_) => _refresh());
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _cardBg, borderRadius: BorderRadius.circular(16),
          border: isLive ? Border.all(color: _liveRed.withOpacity(0.3)) : null,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 4, offset: const Offset(0, 2))]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 5),
            decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(7)),
            child: Text(badgeLabel, textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
          const SizedBox(height: 8),
          Text(name, style: const TextStyle(color: _textDark, fontSize: 13, fontWeight: FontWeight.w700),
            maxLines: 1, softWrap: false, overflow: TextOverflow.clip),
          const SizedBox(height: 4),
          Row(children: [const Icon(Icons.calendar_today_rounded, size: 12, color: _textMuted), const SizedBox(width: 4),
            Expanded(child: Text(date, style: const TextStyle(color: _textMuted, fontSize: 12), softWrap: false, overflow: TextOverflow.clip))]),
          if (location != null && location.isNotEmpty) ...[const SizedBox(height: 2),
            Row(children: [const Icon(Icons.location_on_rounded, size: 12, color: _textMuted), const SizedBox(width: 4),
              Expanded(child: Text(location, style: const TextStyle(color: _textMuted, fontSize: 12), softWrap: false, overflow: TextOverflow.clip))])],
          const SizedBox(height: 2),
          Row(children: [const Icon(Icons.people_rounded, size: 12, color: _textMuted), const SizedBox(width: 4),
            Text(max > 0 ? '$current / $max' : '$current уч.', style: const TextStyle(color: _textMuted, fontSize: 12))]),
        ])));
  }

  Widget _buildFinished(Map<String, dynamic> data) {
    final count = data['finishedCount'] as int;
    if (count == 0) return const SizedBox.shrink();
    return Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Завершённые турниры', style: TextStyle(color: _textDark, fontSize: 20, fontWeight: FontWeight.w700)),
      const SizedBox(height: 12),
      GestureDetector(
        onTap: () => _showSnack('История матчей — следующая фаза'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 6, offset: const Offset(0, 2))]),
          child: Row(children: [
            const Text('🏆', style: TextStyle(fontSize: 28)), const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('История матчей', style: TextStyle(color: _textDark, fontWeight: FontWeight.w600, fontSize: 16)),
              Text('$count завершённых турниров', style: const TextStyle(color: _textMuted, fontSize: 13))])),
            const Icon(Icons.chevron_right_rounded, color: _textMuted)]))),
    ]));
  }

  Widget _buildBottomNav() => Container(
    height: 64,
    decoration: BoxDecoration(color: Colors.white,
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 12, offset: const Offset(0, -2))]),
    child: Row(children: [
      _navItem(0, Icons.sports_tennis_rounded, 'Матчи'),
      _navItem(1, Icons.emoji_events_rounded, 'Турниры'),
      if (_isOrganizer) _navItem(2, Icons.admin_panel_settings_rounded, 'Орг.'),
      _navItem(3, Icons.person_rounded, 'Профиль'),
    ]));

  Widget _navItem(int index, IconData icon, String label) {
    final active = _navIndex == index;
    return Expanded(child: GestureDetector(
      onTap: () {
        if (index == 3) context.go('/profile');
        else if (index == 0) _navigateToMatches(context);
        else if (index == 2 && _isOrganizer) context.go('/organizer');
        else setState(() => _navIndex = index);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200), curve: Curves.easeOut,
        color: active ? const Color(0xFF2C3E6E) : Colors.transparent,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          AnimatedScale(scale: active ? 1.15 : 1.0, duration: const Duration(milliseconds: 200),
            child: Icon(icon, size: 24, color: active ? const Color(0xFFFFD700) : const Color(0xFF7F8C8D))),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: active ? FontWeight.w700 : FontWeight.w400,
            color: active ? const Color(0xFFFFD700) : const Color(0xFF7F8C8D))),
          const SizedBox(height: 2),
          AnimatedContainer(duration: const Duration(milliseconds: 200),
            width: active ? 16 : 0, height: 2,
            decoration: BoxDecoration(color: const Color(0xFFFFD700), borderRadius: BorderRadius.circular(1))),
        ]))));
  }
}

// ─── Available Card ───────────────────────────────────────────────────────────

class _AvailableCard extends StatefulWidget {
  final Map tournament;
  final int current;
  final bool isFull;
  final bool isLive;
  final Future<void> Function() onRegister;
  final VoidCallback onLiveTap;
  const _AvailableCard({required this.tournament, required this.current, required this.isFull, required this.isLive, required this.onRegister, required this.onLiveTap});
  @override
  State<_AvailableCard> createState() => _AvailableCardState();
}

class _AvailableCardState extends State<_AvailableCard> {
  bool _loading = false;
  static const _greenDark = Color(0xFF27AE60);
  static const _blueDark = Color(0xFF2980B9);
  static const _textDark = Color(0xFF2C3E50);
  static const _textMuted = Color(0xFF7F8C8D);
  static const _cardBg = Color(0xD9FFFFFF);
  static const _liveRed = Color(0xFFE74C3C);

  @override
  Widget build(BuildContext context) {
    final t = widget.tournament;
    final name = t['name'] as String? ?? '—';
    final date = _formatDate(t['date'] as String?);
    final time = _formatTime(t['start_time'] as String?);
    final max = t['max_participants'] as int? ?? 0;
    final current = widget.current;
    final isFull = widget.isFull;
    final waitlistEnabled = t['waitlist_enabled'] == true;
    final isLive = widget.isLive;
    final canWaitlist = isFull && waitlistEnabled;
    final location = t['location'] as String?;
    final btnColor = isLive ? _liveRed : canWaitlist ? _blueDark : _greenDark;
    final btnLabel = isLive ? 'Смотреть' : canWaitlist ? 'Waitlist' : 'Join';
    final canAct = isLive || !isFull || waitlistEnabled;

    return GestureDetector(
      onTap: isLive ? widget.onLiveTap : null,
      child: Container(
        decoration: BoxDecoration(
          color: isLive ? const Color(0xFFFFF0F0) : _cardBg,
          borderRadius: BorderRadius.circular(16),
          border: isLive ? Border.all(color: _liveRed.withOpacity(0.4), width: 1.5) : Border.all(color: Colors.white.withOpacity(0.6)),
          boxShadow: [BoxShadow(
            color: isLive ? _liveRed.withOpacity(0.15) : Colors.black.withOpacity(0.10),
            blurRadius: isLive ? 16 : 6, offset: const Offset(0, 3))]),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            if (isLive) ...[
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: _liveRed, borderRadius: BorderRadius.circular(5)),
                child: const Text('LIVE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1))),
              const SizedBox(width: 8)],
            Expanded(child: Text(name, style: TextStyle(color: isLive ? _liveRed : _textDark, fontSize: 17, fontWeight: FontWeight.w700), maxLines: 1, softWrap: false, overflow: TextOverflow.clip)),
          ]),
          const SizedBox(height: 6),
          Row(children: [const Icon(Icons.people_rounded, size: 14, color: _textMuted), const SizedBox(width: 5),
            Text(max > 0 ? '$current / $max участников' : '$current уч.', style: const TextStyle(color: _textMuted, fontSize: 13))]),
          const SizedBox(height: 3),
          Row(children: [const Icon(Icons.access_time_rounded, size: 14, color: _textMuted), const SizedBox(width: 5),
            Text('$date • $time', style: const TextStyle(color: _textMuted, fontSize: 13))]),
          if (location != null && location.isNotEmpty) ...[const SizedBox(height: 3),
            Row(children: [const Icon(Icons.location_on_rounded, size: 14, color: _textMuted), const SizedBox(width: 5),
              Expanded(child: Text(location, style: const TextStyle(color: _textMuted, fontSize: 13), softWrap: false, overflow: TextOverflow.clip))])],
          const Spacer(),
          if (canAct)
            SizedBox(width: double.infinity, height: 36, child: ElevatedButton(
              onPressed: isLive ? widget.onLiveTap : _loading ? null : () async {
                HapticFeedback.lightImpact();
                setState(() => _loading = true);
                await widget.onRegister();
                if (mounted) setState(() => _loading = false);
              },
              style: ElevatedButton.styleFrom(backgroundColor: btnColor, foregroundColor: Colors.white, elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              child: _loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Text(btnLabel)))
          else
            Container(width: double.infinity, height: 36,
              decoration: BoxDecoration(color: const Color(0xFFBDC3C7), borderRadius: BorderRadius.circular(8)),
              child: const Center(child: Text('Заполнен', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)))),
        ])));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE MATCHES SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

class LiveMatchesScreen extends StatefulWidget {
  final String tournamentId;
  final String tournamentName;
  const LiveMatchesScreen({super.key, required this.tournamentId, required this.tournamentName});
  @override
  State<LiveMatchesScreen> createState() => _LiveMatchesScreenState();
}

class _LiveMatchesScreenState extends State<LiveMatchesScreen> with SingleTickerProviderStateMixin {
  static const _bg = AppColors.bg;
  static const _primary = AppColors.green;
  static const _muted = AppColors.textMuted;

  late TabController _tabController;
  bool _showMine = true;
  String? _myUserId;

  late Future<List<Map<String, dynamic>>> _matchesFuture;
  late Future<List<Map<String, dynamic>>> _pairsFuture;
  late Future<List<Map<String, dynamic>>> _standingsFuture;

  RealtimeChannel? _realtimeChannel;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _myUserId = supabase.auth.currentUser?.id;
    _refreshAll();
    _subscribeRealtime();
  }

  void _refreshAll() {
    _matchesFuture = _loadMatches();
    _pairsFuture = _loadPairs();
    _standingsFuture = _loadStandings();
    if (mounted) setState(() {});
  }

  void _subscribeRealtime() {
    _realtimeChannel = supabase.channel('matches_${widget.tournamentId}')
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'matches',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'tournament_id', value: widget.tournamentId),
          callback: (_) => _refreshAll())
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'pairs',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'tournament_id', value: widget.tournamentId),
          callback: (_) => _refreshAll())
        .subscribe();
  }

  @override
  void dispose() { _tabController.dispose(); _realtimeChannel?.unsubscribe(); super.dispose(); }

  Future<List<Map<String, dynamic>>> _loadMatches() async {
    final matchRows = await supabase.from('matches').select('*').eq('tournament_id', widget.tournamentId).order('scheduled_time', ascending: true);
    final matches = List<Map<String, dynamic>>.from(matchRows as List);
    if (matches.isEmpty) return matches;
    final pairIds = <String>{};
    for (final m in matches) { if (m['pair1_id'] != null) pairIds.add(m['pair1_id'] as String); if (m['pair2_id'] != null) pairIds.add(m['pair2_id'] as String); }
    final pairsRows = await supabase.from('pairs').select('id, player1_id, player2_id, games_played, games_won, points').inFilter('id', pairIds.toList());
    final Map<String, Map> pairsMap = { for (final p in pairsRows as List) p['id'] as String: p as Map };
    final playerIds = <String>{};
    for (final p in pairsMap.values) { if (p['player1_id'] != null) playerIds.add(p['player1_id'] as String); if (p['player2_id'] != null) playerIds.add(p['player2_id'] as String); }
    final profilesMap = await _fetchProfiles(playerIds);
    final enrichedPairs = <String, Map<String, dynamic>>{
      for (final entry in pairsMap.entries) entry.key: { ...entry.value, 'p1': profilesMap[entry.value['player1_id']], 'p2': profilesMap[entry.value['player2_id']] }
    };
    return matches.map((m) => { ...m, 'pair1': m['pair1_id'] != null ? enrichedPairs[m['pair1_id']] : null, 'pair2': m['pair2_id'] != null ? enrichedPairs[m['pair2_id']] : null }).toList();
  }

  Future<List<Map<String, dynamic>>> _loadPairs() async {
    final rows = await supabase.from('pairs').select('id, player1_id, player2_id, games_played, games_won, points').eq('tournament_id', widget.tournamentId);
    return _enrichPairsWithProfiles(List<Map<String, dynamic>>.from(rows as List));
  }

  Future<List<Map<String, dynamic>>> _loadStandings() async {
    final rows = await supabase.from('pairs').select('id, player1_id, player2_id, games_played, games_won, points').eq('tournament_id', widget.tournamentId).order('points', ascending: false);
    return _enrichPairsWithProfiles(List<Map<String, dynamic>>.from(rows as List));
  }

  Future<List<Map<String, dynamic>>> _enrichPairsWithProfiles(List<Map<String, dynamic>> pairs) async {
    if (pairs.isEmpty) return pairs;
    final playerIds = <String>{};
    for (final p in pairs) { if (p['player1_id'] != null) playerIds.add(p['player1_id'] as String); if (p['player2_id'] != null) playerIds.add(p['player2_id'] as String); }
    final profiles = await _fetchProfiles(playerIds);
    return pairs.map((p) => {...p, 'p1': profiles[p['player1_id']], 'p2': profiles[p['player2_id']]}).toList();
  }

  void _showScoreDialog(Map<String, dynamic> match) {
    final pairA = _pairName(match['pair1'] as Map?);
    final pairB = _pairName(match['pair2'] as Map?);
    final List<TextEditingController> ctrls = List.generate(6, (_) => TextEditingController());
    void prefill(int set, int ctrl1, int ctrl2) {
      final v1 = match['set${set}_pair1']; final v2 = match['set${set}_pair2'];
      if (v1 != null) ctrls[ctrl1].text = '$v1'; if (v2 != null) ctrls[ctrl2].text = '$v2';
    }
    prefill(1, 0, 1); prefill(2, 2, 3); prefill(3, 4, 5);
    showDialog(context: context, builder: (ctx) => Dialog(
      backgroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Center(child: Text('Ввод счёта матча', style: TextStyle(color: Color(0xFF1A2340), fontWeight: FontWeight.w700, fontSize: 17))),
        const SizedBox(height: 16),
        Row(children: [const SizedBox(width: 80), for (int s = 0; s < 3; s++) ...[if (s > 0) const SizedBox(width: 8), Expanded(child: Text('Сет ${s+1}', textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF7A90A8), fontSize: 12, fontWeight: FontWeight.w600)))]]),
        const SizedBox(height: 8),
        Row(children: [SizedBox(width: 80, child: Text(pairA, style: const TextStyle(color: Color(0xFF1A2340), fontSize: 13, fontWeight: FontWeight.w600), softWrap: false, overflow: TextOverflow.clip)),
          for (int s = 0; s < 3; s++) ...[if (s > 0) const SizedBox(width: 8), Expanded(child: _scoreField(ctrls[s * 2]))]]),
        const SizedBox(height: 8),
        Row(children: [SizedBox(width: 80, child: Text(pairB, style: const TextStyle(color: Color(0xFF1A2340), fontSize: 13, fontWeight: FontWeight.w600), softWrap: false, overflow: TextOverflow.clip)),
          for (int s = 0; s < 3; s++) ...[if (s > 0) const SizedBox(width: 8), Expanded(child: _scoreField(ctrls[s * 2 + 1]))]]),
        const SizedBox(height: 20),
        SizedBox(width: double.infinity, height: 48, child: ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2D9B4F), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
          onPressed: () async { await _saveScore(match, ctrls); if (ctx.mounted) Navigator.pop(ctx); _refreshAll(); },
          child: const Text('Сохранить', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)))),
        const SizedBox(height: 8),
        Center(child: TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена', style: TextStyle(color: Color(0xFF7A90A8), fontSize: 14)))),
      ]))));
  }

  Widget _scoreField(TextEditingController ctrl) => TextField(controller: ctrl, keyboardType: TextInputType.number,
    maxLength: 2, textAlign: TextAlign.center,
    style: const TextStyle(color: Color(0xFF1A2340), fontSize: 20, fontWeight: FontWeight.w700),
    decoration: InputDecoration(counterText: '', filled: true, fillColor: const Color(0xFFF0F6FB),
      contentPadding: const EdgeInsets.symmetric(vertical: 10),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD9E8))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD9E8))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF2D9B4F), width: 2))));

  Future<void> _saveScore(Map<String, dynamic> match, List<TextEditingController> ctrls) async {
    int? s1p1 = int.tryParse(ctrls[0].text); int? s1p2 = int.tryParse(ctrls[1].text);
    int? s2p1 = int.tryParse(ctrls[2].text); int? s2p2 = int.tryParse(ctrls[3].text);
    int? s3p1 = int.tryParse(ctrls[4].text); int? s3p2 = int.tryParse(ctrls[5].text);
    int pair1Sets = 0, pair2Sets = 0;
    if (s1p1 != null && s1p2 != null) { if (s1p1 > s1p2) pair1Sets++; else pair2Sets++; }
    if (s2p1 != null && s2p2 != null) { if (s2p1 > s2p2) pair1Sets++; else pair2Sets++; }
    if (s3p1 != null && s3p2 != null) { if (s3p1 > s3p2) pair1Sets++; else pair2Sets++; }
    final pair1Id = match['pair1_id'] as String?;
    final pair2Id = match['pair2_id'] as String?;
    final winnerId = pair1Sets >= pair2Sets ? pair1Id : pair2Id;
    final loserId = pair1Sets >= pair2Sets ? pair2Id : pair1Id;
    try {
      await supabase.from('matches').update({
        'set1_pair1': s1p1, 'set1_pair2': s1p2, 'set2_pair1': s2p1, 'set2_pair2': s2p2,
        'set3_pair1': s3p1, 'set3_pair2': s3p2, 'winner_pair_id': winnerId,
        'status': 'done', 'score_entered_by': supabase.auth.currentUser?.id,
      }).eq('id', match['id'] as String);
      await _updatePairStats(winnerId, won: true);
      await _updatePairStats(loserId, won: false);
      await _updateProfileStats(match['pair1'] as Map?, pair1Sets > pair2Sets);
      await _updateProfileStats(match['pair2'] as Map?, pair2Sets > pair1Sets);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка: $e'), backgroundColor: const Color(0xFFEF4444)));
    }
  }

  Future<void> _updatePairStats(String? pairId, {required bool won}) async {
    if (pairId == null) return;
    try {
      final row = await supabase.from('pairs').select('games_played, games_won, points').eq('id', pairId).single();
      await supabase.from('pairs').update({
        'games_played': (row['games_played'] as int? ?? 0) + 1,
        'games_won': (row['games_won'] as int? ?? 0) + (won ? 1 : 0),
        'points': (row['points'] as int? ?? 0) + (won ? 3 : 1),
      }).eq('id', pairId);
    } catch (_) {}
  }

  Future<void> _updateProfileStats(Map? pair, bool isWinner) async {
    if (pair == null) return;
    for (final playerId in [pair['player1_id'], pair['player2_id']]) {
      if (playerId == null) continue;
      try {
        final row = await supabase.from('profiles').select('matches, wins').eq('id', playerId as String).maybeSingle();
        if (row == null) continue;
        await supabase.from('profiles').update({
          'matches': (row['matches'] as int? ?? 0) + 1,
          'wins': (row['wins'] as int? ?? 0) + (isWinner ? 1 : 0),
        }).eq('id', playerId);
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(backgroundColor: _bg,
      appBar: AppBar(backgroundColor: Colors.white, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1A2340)), onPressed: () => context.go('/')),
        title: Text(widget.tournamentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF1A2340))),
        centerTitle: true,
        bottom: TabBar(controller: _tabController, indicatorColor: _primary, indicatorWeight: 3,
          labelColor: _primary, unselectedLabelColor: _muted,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [Tab(text: 'МАТЧИ'), Tab(text: 'ПАРЫ'), Tab(text: 'ТАБЛИЦА')])),
      body: TabBarView(controller: _tabController, children: [
        _MatchesTab(tournamentId: widget.tournamentId, myUserId: _myUserId, showMine: _showMine,
          onToggle: (v) => setState(() => _showMine = v), onCardTap: _showScoreDialog,
          matchesFuture: _matchesFuture, onRefresh: _refreshAll),
        _PairsTab(pairsFuture: _pairsFuture, onRefresh: _refreshAll),
        _StandingsTab(standingsFuture: _standingsFuture, onRefresh: _refreshAll),
      ]),
      bottomNavigationBar: _MatchesBottomNav(
        onMatchesTap: () {}, onTournamentsTap: () => context.go('/'), onProfileTap: () => context.go('/profile')),
    );
  }
}

// ─── Matches Tab ──────────────────────────────────────────────────────────────

class _MatchesTab extends StatelessWidget {
  final String tournamentId;
  final String? myUserId;
  final bool showMine;
  final ValueChanged<bool> onToggle;
  final void Function(Map<String, dynamic>) onCardTap;
  final Future<List<Map<String, dynamic>>> matchesFuture;
  final VoidCallback onRefresh;
  static const _primary = AppColors.green;
  static const _muted = AppColors.textMuted;
  const _MatchesTab({required this.tournamentId, required this.myUserId, required this.showMine, required this.onToggle, required this.onCardTap, required this.matchesFuture, required this.onRefresh});

  bool _isMyMatch(Map<String, dynamic> m) {
    final uid = myUserId; if (uid == null) return false;
    final p1 = m['pair1'] as Map?; final p2 = m['pair2'] as Map?;
    return p1?['player1_id'] == uid || p1?['player2_id'] == uid || p2?['player1_id'] == uid || p2?['player2_id'] == uid;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(future: matchesFuture, builder: (context, snap) {
      return RefreshIndicator(color: _primary, onRefresh: () async => onRefresh(),
        child: Column(children: [
          const SizedBox(height: 12),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: _MineAllToggle(showMine: showMine, onToggle: onToggle)),
          const SizedBox(height: 12),
          Expanded(child: snap.connectionState == ConnectionState.waiting
              ? const Center(child: CircularProgressIndicator(color: _primary))
              : snap.hasError ? Center(child: Text('Ошибка загрузки', style: TextStyle(color: _muted)))
              : _buildList(snap.data ?? [])),
        ]));
    });
  }

  Widget _buildList(List<Map<String, dynamic>> all) {
    List<Map<String, dynamic>> matches = showMine ? all.where(_isMyMatch).toList() : all;
    matches = List.from(matches);
    matches.sort((a, b) {
      int priority(Map m) { final s = m['status'] as String? ?? ''; if (s == 'done') return 0; if (s == 'live') return 1; return 2; }
      final p = priority(a).compareTo(priority(b)); if (p != 0) return p;
      return (a['scheduled_time'] as String? ?? '').compareTo(b['scheduled_time'] as String? ?? '');
    });
    if (matches.isEmpty) return ListView(children: [const SizedBox(height: 80),
      Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.sports_tennis_rounded, color: _muted, size: 48), const SizedBox(height: 12),
        Text(showMine ? 'У вас нет матчей в этом турнире' : 'Матчи не найдены', style: TextStyle(color: _muted))]))]);
    return ListView.builder(padding: const EdgeInsets.symmetric(horizontal: 16), itemCount: matches.length,
      itemBuilder: (ctx, i) => _MatchCard(match: matches[i], isMyMatch: _isMyMatch(matches[i]), onTap: () => onCardTap(matches[i])));
  }
}

// ─── Match Card ───────────────────────────────────────────────────────────────

class _MatchCard extends StatelessWidget {
  final Map<String, dynamic> match;
  final bool isMyMatch;
  final VoidCallback onTap;
  static const _muted = Color(0xFF7A90A8);
  static const _live = Color(0xFFEF4444);
  static const _done = Color(0xFF2D9B4F);
  const _MatchCard({required this.match, required this.isMyMatch, required this.onTap});

  String _fmtTime(String? iso) {
    if (iso == null) return '—';
    try { final dt = DateTime.parse(iso).toLocal(); return '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}'; }
    catch (_) { if (iso.contains(':')) return iso.substring(0, 5); return iso; }
  }

  @override
  Widget build(BuildContext context) {
    final status = match['status'] as String? ?? 'waiting';
    final isLive = status == 'live'; final isDone = status == 'done';
    final pairA = _pairName(match['pair1'] as Map?);
    final pairB = _pairName(match['pair2'] as Map?);
    final courtNum = match['court_number'];
    final time = _fmtTime(match['scheduled_time'] as String?);
    final winnerId = match['winner_pair_id'] as String?;
    final pair1Id = (match['pair1'] as Map?)?['id'] as String?;
    final winner = winnerId == null ? null : (winnerId == pair1Id ? pairA : pairB);
    String scoreStr = '';
    if (isDone) { final sets = <String>[]; for (int s = 1; s <= 3; s++) { final p1 = match['set${s}_pair1']; final p2 = match['set${s}_pair2']; if (p1 != null && p2 != null) sets.add('$p1:$p2'); } scoreStr = sets.join(' · '); }

    if (isLive && isMyMatch) {
      return GestureDetector(onTap: onTap, child: Container(margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        decoration: BoxDecoration(color: const Color(0xFFFFE5E5), borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _live.withOpacity(0.2)),
          boxShadow: [BoxShadow(color: _live.withOpacity(0.12), blurRadius: 12, offset: const Offset(0, 4))]),
        child: Column(children: [
          Row(children: [Expanded(child: Divider(color: _live.withOpacity(0.4), thickness: 1)), const SizedBox(width: 10),
            Text('LIVE', style: TextStyle(color: _live, fontWeight: FontWeight.w900, fontSize: 15, letterSpacing: 3)), const SizedBox(width: 10),
            Expanded(child: Divider(color: _live.withOpacity(0.4), thickness: 1))]),
          const SizedBox(height: 10),
          Text('$pairA – $pairB', style: TextStyle(color: _live, fontWeight: FontWeight.w800, fontSize: 15), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [const Text('🎾', style: TextStyle(fontSize: 15)), const SizedBox(width: 6),
            Text(courtNum != null ? 'Корт $courtNum · $time' : time, style: const TextStyle(color: Color(0xFF1A2340), fontWeight: FontWeight.w700, fontSize: 15))]),
        ])));
    }

    if (isLive) {
      return GestureDetector(onTap: onTap, child: Container(margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(color: const Color(0xFFFFF5F5), borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6, offset: const Offset(0, 2))]),
        child: Row(children: [
          Text('LIVE', style: TextStyle(color: _live, fontWeight: FontWeight.w800, fontSize: 11)), const SizedBox(width: 10),
          Expanded(child: Text('$pairA – $pairB', style: const TextStyle(color: Color(0xFF1A2340), fontSize: 13, fontWeight: FontWeight.w600), softWrap: false, overflow: TextOverflow.clip)),
          Text(courtNum != null ? 'Корт $courtNum · $time' : time, style: TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w600))])));
    }

    if (isDone) {
      return GestureDetector(onTap: onTap, child: Container(margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6, offset: const Offset(0, 2))]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: _done.withOpacity(0.12), borderRadius: BorderRadius.circular(5)),
            child: Text('DONE', style: TextStyle(color: _done, fontWeight: FontWeight.w800, fontSize: 11))),
            const Spacer(), Text(time, style: const TextStyle(color: Color(0xFF7A90A8), fontSize: 12))]),
          const SizedBox(height: 8),
          if (scoreStr.isNotEmpty) Text(scoreStr, style: const TextStyle(color: Color(0xFF1A2340), fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 4),
          Text('$pairA – $pairB', style: TextStyle(color: _muted, fontSize: 12), softWrap: false, overflow: TextOverflow.clip),
          if (winner != null) ...[const SizedBox(height: 6), Row(children: [const Text('🏆', style: TextStyle(fontSize: 14)), const SizedBox(width: 6),
            Expanded(child: Text(winner, style: TextStyle(color: _done, fontWeight: FontWeight.w700, fontSize: 13), softWrap: false, overflow: TextOverflow.clip))])],
        ])));
    }

    return GestureDetector(onTap: onTap, child: Container(margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: const Color(0xFFF0F6FB), borderRadius: BorderRadius.circular(5), border: Border.all(color: const Color(0xFFCBD9E8))),
            child: Text('WAITING', style: TextStyle(color: _muted, fontWeight: FontWeight.w700, fontSize: 10, letterSpacing: 0.5))),
          const Spacer(),
          if (courtNum != null) ...[const Icon(Icons.sports_tennis_rounded, size: 13, color: Color(0xFF7A90A8)), const SizedBox(width: 4),
            Text('Корт $courtNum', style: TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w600)), const SizedBox(width: 8)],
          const Icon(Icons.access_time_rounded, size: 13, color: Color(0xFF7A90A8)), const SizedBox(width: 4),
          Text(time, style: TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w600))]),
        const SizedBox(height: 6),
        Text('$pairA – $pairB', style: const TextStyle(color: Color(0xFF1A2340), fontSize: 13, fontWeight: FontWeight.w500), softWrap: false, overflow: TextOverflow.clip),
      ])));
  }
}

// ─── Mine/All Toggle ─────────────────────────────────────────────────────────

class _MineAllToggle extends StatelessWidget {
  final bool showMine;
  final ValueChanged<bool> onToggle;
  const _MineAllToggle({required this.showMine, required this.onToggle});

  @override
  Widget build(BuildContext context) => Container(height: 42,
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 6, offset: const Offset(0, 2))]),
    child: Row(children: [_tab('Мои', true, const Color(0xFF2D9B4F)), _tab('Все', false, const Color(0xFF1B4FD8))]));

  Widget _tab(String label, bool isMine, Color activeColor) {
    final selected = showMine == isMine;
    return Expanded(child: GestureDetector(onTap: () => onToggle(isMine),
      child: AnimatedContainer(duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(color: selected ? activeColor : Colors.transparent, borderRadius: BorderRadius.circular(12)),
        alignment: Alignment.center,
        child: Text(label, style: TextStyle(color: selected ? Colors.white : const Color(0xFF7A90A8), fontWeight: FontWeight.w700, fontSize: 14)))));
  }
}

// ─── Pairs Tab ────────────────────────────────────────────────────────────────

class _PairsTab extends StatelessWidget {
  final Future<List<Map<String, dynamic>>> pairsFuture;
  final VoidCallback onRefresh;
  static const _muted = AppColors.textMuted;
  const _PairsTab({required this.pairsFuture, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(future: pairsFuture, builder: (context, snap) {
      if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: AppColors.green));
      if (snap.hasError || (snap.data?.isEmpty ?? true)) {
        return RefreshIndicator(color: AppColors.green, onRefresh: () async => onRefresh(),
          child: ListView(children: [Center(child: Padding(padding: const EdgeInsets.only(top: 80),
            child: Text('Данные о парах не найдены', style: TextStyle(color: _muted))))]));
      }
      final pairs = snap.data!;
      return RefreshIndicator(color: AppColors.green, onRefresh: () async => onRefresh(),
        child: Container(margin: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 3))]),
          child: Column(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFE8F0F7)))),
              child: Row(children: [const Expanded(child: Text('Пара', style: TextStyle(color: Color(0xFF7A90A8), fontSize: 12, fontWeight: FontWeight.w600))),
                Text('Сыгр / Побед', style: TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w600))])),
            Expanded(child: ListView.separated(padding: EdgeInsets.zero, itemCount: pairs.length,
              separatorBuilder: (_, __) => const Divider(color: Color(0xFFE8F0F7), height: 1),
              itemBuilder: (ctx, i) { final p = pairs[i]; return Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                child: Row(children: [Expanded(child: Text(_pairName(p), style: const TextStyle(color: Color(0xFF1A2340), fontSize: 14))),
                  Text('${p['games_played'] ?? 0} / ${p['games_won'] ?? 0}', style: const TextStyle(color: Color(0xFF1A2340), fontSize: 14, fontWeight: FontWeight.w600))])); })),
          ])));
    });
  }
}

// ─── Standings Tab ────────────────────────────────────────────────────────────

class _StandingsTab extends StatelessWidget {
  final Future<List<Map<String, dynamic>>> standingsFuture;
  final VoidCallback onRefresh;
  static const _muted = AppColors.textMuted;
  static const _gold = AppColors.gold;
  const _StandingsTab({required this.standingsFuture, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(future: standingsFuture, builder: (context, snap) {
      if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: AppColors.green));
      if (snap.hasError || (snap.data?.isEmpty ?? true)) {
        return RefreshIndicator(color: AppColors.green, onRefresh: () async => onRefresh(),
          child: ListView(children: [Center(child: Padding(padding: const EdgeInsets.only(top: 80), child: Text('Таблица пока не сформирована', style: TextStyle(color: _muted))))]));
      }
      final rows = snap.data!;
      return RefreshIndicator(color: AppColors.green, onRefresh: () async => onRefresh(),
        child: Container(margin: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 3))]),
          child: Column(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFE8F0F7)))),
              child: Row(children: [const SizedBox(width: 28),
                const Expanded(child: Text('Пара', style: TextStyle(color: Color(0xFF7A90A8), fontSize: 12, fontWeight: FontWeight.w600))),
                for (final col in ['И', 'В', 'П', 'О'])
                  SizedBox(width: 30, child: Text(col, style: const TextStyle(color: Color(0xFF7A90A8), fontSize: 12, fontWeight: FontWeight.w700), textAlign: TextAlign.center))])),
            Expanded(child: ListView.builder(padding: EdgeInsets.zero, itemCount: rows.length, itemBuilder: (ctx, i) {
              final r = rows[i]; final rank = i + 1;
              final played = r['games_played'] ?? 0; final wins = r['games_won'] ?? 0;
              final losses = (played as int) - (wins as int); final points = r['points'] ?? 0;
              final isTop = rank <= 2;
              return Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                decoration: BoxDecoration(color: isTop ? _gold.withOpacity(0.07) : Colors.transparent,
                  border: const Border(bottom: BorderSide(color: Color(0xFFE8F0F7), width: 0.5))),
                child: Row(children: [
                  SizedBox(width: 28, child: Text('$rank', style: TextStyle(color: isTop ? _gold : _muted, fontSize: 14, fontWeight: FontWeight.w800))),
                  Expanded(child: Text(_pairName(r), style: const TextStyle(color: Color(0xFF1A2340), fontSize: 13), softWrap: false, overflow: TextOverflow.clip)),
                  for (final val in [played, wins, losses, points])
                    SizedBox(width: 30, child: Text('$val', style: TextStyle(color: const Color(0xFF1A2340), fontSize: 13,
                      fontWeight: val == points ? FontWeight.w800 : FontWeight.w500), textAlign: TextAlign.center)),
                ]));
            })),
          ])));
    });
  }
}

// ─── Matches Bottom Nav ───────────────────────────────────────────────────────

class _MatchesBottomNav extends StatelessWidget {
  final VoidCallback onMatchesTap;
  final VoidCallback onTournamentsTap;
  final VoidCallback onProfileTap;
  static const _primary = AppColors.green;
  static const _muted = AppColors.textMuted;
  const _MatchesBottomNav({required this.onMatchesTap, required this.onTournamentsTap, required this.onProfileTap});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: Colors.white,
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, -2))]),
    child: BottomNavigationBar(currentIndex: 0, backgroundColor: Colors.transparent, elevation: 0,
      selectedItemColor: _primary, unselectedItemColor: _muted,
      selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
      unselectedLabelStyle: const TextStyle(fontSize: 11),
      onTap: (i) { if (i == 0) onMatchesTap(); if (i == 1) onTournamentsTap(); if (i == 2) onProfileTap(); },
      items: const [
        BottomNavigationBarItem(icon: Icon(Icons.sports_tennis_rounded), label: 'Матчи'),
        BottomNavigationBarItem(icon: Icon(Icons.emoji_events_rounded), label: 'Турниры'),
        BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: 'Профиль'),
      ]));
}
