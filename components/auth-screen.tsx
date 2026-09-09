"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CircleUserRound,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { FeatureTabs } from "./feature-tabs";
import { SiteHeader } from "./site-header";
import { AuthLottie } from "./auth-lottie";
import { sendMsg91WidgetOtp, verifyMsg91WidgetOtp } from "./msg91-widget-client";

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  isAdmin?: boolean;
};

type Mode = "login" | "register";
type VerifyMode = "register" | "reset_password";

type Challenge = {
  phone: string;
  reqId?: string;
};

export function AuthScreen({ onSignedIn }: { onSignedIn: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const switchMode = (next: Mode) => {
    setMode(next);
    setChallenge(null);
    setOtp("");
    setResetPassword(false);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  function validatePasswordPair() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return false;
    }
    return true;
  }

  function validateRegistration() {
    if (name.trim().length < 2) {
      toast.error("Enter your name.");
      return false;
    }
    if (city.trim().length < 2) {
      toast.error("Enter your city.");
      return false;
    }
    if (phone.replace(/\D/g, "").length !== 10) {
      toast.error("Enter a valid 10-digit mobile number.");
      return false;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Enter a valid email address or leave it blank.");
      return false;
    }
    if (!validatePasswordPair()) return false;
    if (!acceptedTerms) {
      toast.error("Accept the Terms & Conditions to continue.");
      return false;
    }
    return true;
  }

  async function loginWithPassword() {
    if (!identifier.trim()) return toast.error("Enter your mobile number or email.");
    if (!password) return toast.error("Enter your password.");

    setLoading(true);
    try {
      const response = await fetch("/api/auth/password/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const payload = await response.json() as { user?: AuthUser; error?: string; code?: string };
      if (!response.ok || !payload.user) {
        if (payload.code === "password_reset_required") {
          startResetPassword();
          toast.error(payload.error ?? "Use Forgot your password to complete the one-time security reset.");
          return;
        }
        throw new Error(payload.error ?? "Login failed.");
      }
      onSignedIn(payload.user);
      toast.success("Signed in.");
      navigateAfterSignIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function requestRegistrationOtp() {
    if (!validateRegistration()) return;
    await requestMobileOtp("register");
  }

  async function requestResetOtp() {
    if (phone.replace(/\D/g, "").length !== 10) {
      toast.error("Enter the mobile number linked to your account.");
      return;
    }
    if (!validatePasswordPair()) return;
    await requestMobileOtp("reset_password");
  }

  async function requestMobileOtp(purpose: VerifyMode) {
    setLoading(true);
    try {
      const mobile = `91${phone.replace(/\D/g, "")}`;
      const result = await sendMsg91WidgetOtp(mobile);
      setChallenge({
        phone: mobile,
        reqId: result.reqId,
      });
      setOtp("");
      toast.success("OTP sent.");
      if (purpose === "reset_password") setResetPassword(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "OTP could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!challenge || otp.length !== 6) return;
    const verifyMode: VerifyMode = resetPassword ? "reset_password" : "register";
    if (!validatePasswordPair()) return;

    setLoading(true);
    try {
      const accessToken = await verifyMsg91WidgetOtp(otp, challenge.reqId);
      const response = await fetch("/api/auth/mobile/widget-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessToken,
          phone: challenge.phone,
          mode: verifyMode,
          password,
          ...(verifyMode === "register" ? {
            name: name.trim(),
            city: city.trim(),
            email: email.trim() ? email.trim().toLowerCase() : undefined,
            acceptedTerms: true,
          } : {}),
        }),
      });
      const payload = await response.json() as { user?: AuthUser; accountState?: "created" | "existing" | "password-reset"; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error ?? "Verification failed.");
      onSignedIn(payload.user);
      toast.success(verifyMode === "register" ? (payload.accountState === "existing" ? "Account verified. Signed in." : "Account created.") : "Password updated.");
      navigateAfterSignIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  function navigateAfterSignIn() {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    if (returnTo && /^\/(?!\/)/.test(returnTo)) window.location.assign(returnTo);
  }

  function startResetPassword() {
    setResetPassword(true);
    setChallenge(null);
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);

    const digits = identifier.replace(/\D/g, "");
    if (digits.length === 10) setPhone(digits);
    if (digits.length === 12 && digits.startsWith("91")) setPhone(digits.slice(2));
  }

  function backToLogin() {
    setResetPassword(false);
    setChallenge(null);
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  const heading = resetPassword
    ? "Reset your password."
    : mode === "login"
      ? "Welcome back."
      : "Create your account.";

  const prettyPhone = challenge
    ? `+${challenge.phone.slice(0, 2)} ${challenge.phone.slice(2, 7)} ${challenge.phone.slice(7)}`
    : "";

  return (
    <div className="app-wallpaper min-h-screen text-slate-950">
      <SiteHeader />
      <FeatureTabs />

      <main className="mx-auto w-full max-w-[1120px] px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="auth-shell liquid-panel overflow-hidden rounded-[30px]">
          <div className="auth-visual-panel p-5 sm:p-7 lg:p-9">
            <h1 className="max-w-md text-3xl font-black tracking-[-.045em] text-slate-950 sm:text-4xl">{heading}</h1>
            <div className="auth-lottie-wrap mt-3 h-[190px] sm:h-[230px] lg:mt-6 lg:h-[330px]">
              <AuthLottie />
            </div>
          </div>

          <div className="auth-form-panel p-4 sm:p-7 lg:p-9">
            {challenge ? (
              <OtpForm
                otp={otp}
                setOtp={setOtp}
                phone={prettyPhone}
                loading={loading}
                actionLabel={resetPassword ? "Verify OTP & reset password" : "Verify OTP & create account"}
                onVerify={verifyOtp}
                onChangeNumber={() => { setChallenge(null); setOtp(""); }}
              />
            ) : resetPassword ? (
              <ResetPasswordForm
                phone={phone}
                setPhone={setPhone}
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                loading={loading}
                onSendOtp={requestResetOtp}
                onBack={backToLogin}
              />
            ) : (
              <>
                <div className="auth-mode-switch grid grid-cols-2 rounded-2xl p-1.5" role="tablist" aria-label="Authentication mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "login"}
                    onClick={() => switchMode("login")}
                    className={`auth-mode-button ${mode === "login" ? "auth-mode-button-active" : ""}`}
                  >
                    <CircleUserRound className="size-4" /> Login
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "register"}
                    onClick={() => switchMode("register")}
                    className={`auth-mode-button ${mode === "register" ? "auth-mode-button-active" : ""}`}
                  >
                    <UserPlus className="size-4" /> Register
                  </button>
                </div>

                {mode === "login" ? (
                  <LoginForm
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    password={password}
                    setPassword={setPassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    loading={loading}
                    onLogin={loginWithPassword}
                    onForgotPassword={startResetPassword}
                  />
                ) : (
                  <RegisterForm
                    name={name}
                    setName={setName}
                    city={city}
                    setCity={setCity}
                    phone={phone}
                    setPhone={setPhone}
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    confirmPassword={confirmPassword}
                    setConfirmPassword={setConfirmPassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    acceptedTerms={acceptedTerms}
                    setAcceptedTerms={setAcceptedTerms}
                    loading={loading}
                    onRegister={requestRegistrationOtp}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function LoginForm({
  identifier,
  setIdentifier,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  loading,
  onLogin,
  onForgotPassword,
}: {
  identifier: string;
  setIdentifier: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  loading: boolean;
  onLogin: () => void;
  onForgotPassword: () => void;
}) {
  return (
    <div className="mt-6">
      <Label htmlFor="login-identifier" className="text-xs font-extrabold text-slate-800">Mobile number / Email</Label>
      <div className="relative mt-2">
        <CircleUserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id="login-identifier"
          autoComplete="username"
          className="data-entry h-12 pl-9"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Mobile number or email"
        />
      </div>

      <Label htmlFor="login-password" className="mt-4 block text-xs font-extrabold text-slate-800">Password</Label>
      <PasswordInput
        id="login-password"
        value={password}
        setValue={setPassword}
        show={showPassword}
        setShow={setShowPassword}
        autoComplete="current-password"
      />

      <div className="mt-2 flex justify-end">
        <button type="button" className="text-xs font-bold text-blue-700 hover:underline" onClick={onForgotPassword}>
          Forgot your password?
        </button>
      </div>

      <Button className="liquid-button mt-4 h-12 w-full rounded-xl font-extrabold" onClick={onLogin} disabled={loading || !identifier.trim() || !password}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Login
      </Button>
    </div>
  );
}

function RegisterForm({
  name,
  setName,
  city,
  setCity,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  acceptedTerms,
  setAcceptedTerms,
  loading,
  onRegister,
}: {
  name: string;
  setName: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (value: boolean) => void;
  loading: boolean;
  onRegister: () => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="register-name" className="text-xs font-extrabold text-slate-800">Name</Label>
          <div className="relative mt-2">
            <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input id="register-name" autoComplete="name" className="data-entry h-12 pl-9" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </div>
        </div>
        <div>
          <Label htmlFor="register-city" className="text-xs font-extrabold text-slate-800">City</Label>
          <div className="relative mt-2">
            <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input id="register-city" autoComplete="address-level2" className="data-entry h-12 pl-9" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Your city" />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="register-phone" className="text-xs font-extrabold text-slate-800">Mobile number <span className="text-red-600">*</span></Label>
        <div className="auth-phone-input mt-2 flex overflow-hidden rounded-xl">
          <span className="grid min-h-12 place-items-center border-r border-blue-200/80 px-3 text-sm font-extrabold text-slate-800">+91</span>
          <div className="relative min-w-0 flex-1">
            <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="register-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              maxLength={10}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-12 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              placeholder="9876543210"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="register-email" className="text-xs font-extrabold text-slate-800">Email <span className="font-medium text-slate-400">(optional)</span></Label>
        <div className="relative mt-2">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input id="register-email" type="email" autoComplete="email" className="data-entry h-12 pl-9" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
        </div>
      </div>

      <div>
        <Label htmlFor="register-password" className="text-xs font-extrabold text-slate-800">Create password <span className="text-red-600">*</span></Label>
        <PasswordInput id="register-password" value={password} setValue={setPassword} show={showPassword} setShow={setShowPassword} autoComplete="new-password" />
      </div>

      <div>
        <Label htmlFor="register-confirm-password" className="text-xs font-extrabold text-slate-800">Confirm password <span className="text-red-600">*</span></Label>
        <PasswordInput id="register-confirm-password" value={confirmPassword} setValue={setConfirmPassword} show={showPassword} setShow={setShowPassword} autoComplete="new-password" />
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100/90 bg-white/45 p-3">
        <Checkbox id="register-terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} className="mt-0.5" />
        <Label htmlFor="register-terms" className="cursor-pointer text-[11px] font-medium leading-5 text-slate-600">
          I accept the <Link href="/terms" className="font-bold text-blue-700 hover:underline">Terms & Conditions</Link> and <Link href="/privacy" className="font-bold text-blue-700 hover:underline">Privacy Policy</Link>.
        </Label>
      </div>

      <div id="smg-msg91-captcha" className="flex min-h-0 justify-center" />

      <Button className="liquid-button h-12 w-full rounded-xl font-extrabold" onClick={onRegister} disabled={loading}>
        {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MessageSquareText className="mr-2 size-4" />}
        Register with mobile OTP
      </Button>
    </div>
  );
}

function ResetPasswordForm({
  phone,
  setPhone,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  loading,
  onSendOtp,
  onBack,
}: {
  phone: string;
  setPhone: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  loading: boolean;
  onSendOtp: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mt-1">
      <Label htmlFor="reset-phone" className="text-xs font-extrabold text-slate-800">Mobile number</Label>
      <div className="auth-phone-input mt-2 flex overflow-hidden rounded-xl">
        <span className="grid min-h-12 place-items-center border-r border-blue-200/80 px-3 text-sm font-extrabold text-slate-800">+91</span>
        <div className="relative min-w-0 flex-1">
          <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input id="reset-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} maxLength={10} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} className="h-12 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0" placeholder="9876543210" />
        </div>
      </div>

      <Label htmlFor="reset-password" className="mt-4 block text-xs font-extrabold text-slate-800">New password</Label>
      <PasswordInput id="reset-password" value={password} setValue={setPassword} show={showPassword} setShow={setShowPassword} autoComplete="new-password" />

      <Label htmlFor="reset-confirm-password" className="mt-4 block text-xs font-extrabold text-slate-800">Confirm new password</Label>
      <PasswordInput id="reset-confirm-password" value={confirmPassword} setValue={setConfirmPassword} show={showPassword} setShow={setShowPassword} autoComplete="new-password" />

      <div id="smg-msg91-captcha" className="mt-4 flex min-h-0 justify-center" />

      <Button className="liquid-button mt-5 h-12 w-full rounded-xl font-extrabold" onClick={onSendOtp} disabled={loading || phone.length !== 10 || !password || !confirmPassword}>
        {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MessageSquareText className="mr-2 size-4" />}
        Send reset OTP
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-xs font-extrabold text-slate-600" onClick={onBack}>Back to login</Button>
    </div>
  );
}

function OtpForm({
  otp,
  setOtp,
  phone,
  loading,
  actionLabel,
  onVerify,
  onChangeNumber,
}: {
  otp: string;
  setOtp: (value: string) => void;
  phone: string;
  loading: boolean;
  actionLabel: string;
  onVerify: () => void;
  onChangeNumber: () => void;
}) {
  return (
    <div className="mt-1">
      <span className="liquid-icon grid size-12 place-items-center rounded-2xl text-blue-600"><LockKeyhole className="size-5" /></span>
      <h2 className="mt-5 text-2xl font-black tracking-[-.035em]">Enter the 6-digit OTP</h2>
      <p className="mt-2 text-sm text-slate-500">Sent to <span className="font-bold text-slate-800">{phone}</span></p>
      <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="mt-6 justify-between gap-1.5 sm:justify-start sm:gap-2">
        <InputOTPGroup className="w-full justify-between gap-1.5 sm:w-auto sm:justify-start sm:gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot key={index} index={index} className="h-12 min-w-0 flex-1 rounded-xl border-blue-200 bg-white/70 text-base font-black sm:w-12 sm:flex-none" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <Button className="liquid-button mt-5 h-12 w-full rounded-xl font-extrabold" onClick={onVerify} disabled={loading || otp.length !== 6}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {actionLabel}
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-xs font-extrabold text-slate-600" onClick={onChangeNumber}>Change mobile number</Button>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  setValue,
  show,
  setShow,
  autoComplete,
}: {
  id: string;
  value: string;
  setValue: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  autoComplete: string;
}) {
  return (
    <div className="relative mt-2">
      <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} className="data-entry h-12 pl-9 pr-11" value={value} onChange={(event) => setValue(event.target.value)} placeholder="At least 8 characters" />
      <button type="button" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
