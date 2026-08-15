"use client";
import { tt } from '@/lib/i18n/runtime';
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Shield,
  UserCircle,
} from "lucide-react";
import LanguageSettingsCard from "@/components/i18n/LanguageSettingsCard";
import { useI18n } from "@/components/i18n/I18nProvider";
import PageHeader from "@/components/shell/PageHeader";

const getMessageTone = (message) =>
  message?.toLowerCase().includes("success") ? "success" : "error";

function InlineMessage({ message }) {
  if (!message) return null;
  const tone = getMessageTone(message);
  const success = tone === "success";

  return (
    <div
      className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
        success
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {success ? (
        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

function PasswordField({
  label,
  name,
  value,
  visible,
  error,
  onChange,
  onToggle,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          className={`w-full rounded-2xl border bg-white px-3 py-2.5 pr-11 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
            error ? "border-red-400" : "border-slate-200"
          }`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-blue-600"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

export default function Profile() {
  const { t } = useI18n();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data))
      .catch(() => setProfileMsg("Failed to load profile"));
  }, []);

  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    setPasswordErrors({ ...passwordErrors, [e.target.name]: "" });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoadingProfile(true);
    setProfileMsg("");
    setErrors({});

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });

    setLoadingProfile(false);

    if (res.ok) {
      setProfileMsg("Profile updated successfully");
    } else {
      const error = await res.json();
      setProfileMsg(error.message || "Failed to update profile");
      if (error.errors) setErrors(error.errors);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setLoadingPassword(true);
    setPasswordMsg("");
    setPasswordErrors({});

    const { currentPassword, newPassword, confirmPassword } = passwords;
    const clientErrors = {};

    if (!currentPassword) clientErrors.currentPassword = "Current password is required";
    if (!newPassword) clientErrors.newPassword = "New password is required";
    if (!confirmPassword) {
      clientErrors.confirmPassword = "Please confirm your new password";
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      clientErrors.confirmPassword = "New password and confirmation do not match";
    }

    if (Object.keys(clientErrors).length > 0) {
      setPasswordErrors(clientErrors);
      setLoadingPassword(false);
      return;
    }

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwordUpdate: passwords }),
    });

    setLoadingPassword(false);

    if (res.ok) {
      setPasswordMsg("Password updated successfully");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } else {
      const error = await res.json();
      setPasswordMsg(error.message || "Failed to update password");
      if (error.errors) setPasswordErrors(error.errors);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background-secondary)]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader
          title={t("navigation.profile")}
          description="Update your personal details, language preferences, and sign-in credentials."
          breadcrumb={
            <span className="inline-flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-[var(--action-primary)]" aria-hidden="true" />
              {t("navigation.profile")}
            </span>
          }
        />

        <div className="mb-6">
          <LanguageSettingsCard />
        </div>

        <div className="grid gap-6">
          <form
            onSubmit={saveProfile}
            className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <UserCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{tt('Profile details')}</h2>
                <p className="text-sm text-gray-600">
                  {tt('Keep your tenant-facing identity and contact details up to date.')}
                </p>
              </div>
            </div>

            <InlineMessage message={profileMsg} />

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">{tt('Name')}</label>
                <input
                  name="name"
                  value={profile.name || ""}
                  onChange={handleProfileChange}
                  className={`w-full rounded-2xl border bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    errors.name ? "border-red-400" : "border-slate-200"
                  }`}
                />
                {errors.name ? <p className="mt-1 text-xs text-red-500">{errors.name}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email (read-only)
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={profile.email || ""}
                    disabled
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">{tt('Phone')}</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    name="phone"
                    value={profile.phone || ""}
                    onChange={handleProfileChange}
                    className={`w-full rounded-2xl border bg-white px-10 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      errors.phone ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                </div>
                {errors.phone ? <p className="mt-1 text-xs text-red-500">{errors.phone}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Role (read-only)
                </label>
                <div className="relative">
                  <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={profile.role || ""}
                    disabled
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingProfile}
              >
                {loadingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tt('Saving...')}
                  </>
                ) : (
                  "Save Profile"
                )}
              </button>
            </div>
          </form>

          <form
            onSubmit={updatePassword}
            className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-sm backdrop-blur-xl"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{tt('Update password')}</h2>
                <p className="text-sm text-gray-600">
                  {tt('Change your password with the same blue CTA and glass shell used across tenant settings.')}
                </p>
              </div>
            </div>

            <InlineMessage message={passwordMsg} />

            <div className="space-y-4">
              <PasswordField
                label="Current Password"
                name="currentPassword"
                value={passwords.currentPassword}
                visible={showCurrent}
                error={passwordErrors.currentPassword}
                onChange={handlePasswordChange}
                onToggle={() => setShowCurrent(!showCurrent)}
              />
              <PasswordField
                label="New Password"
                name="newPassword"
                value={passwords.newPassword}
                visible={showNew}
                error={passwordErrors.newPassword}
                onChange={handlePasswordChange}
                onToggle={() => setShowNew(!showNew)}
              />
              <PasswordField
                label="Confirm New Password"
                name="confirmPassword"
                value={passwords.confirmPassword}
                visible={showConfirm}
                error={passwordErrors.confirmPassword}
                onChange={handlePasswordChange}
                onToggle={() => setShowConfirm(!showConfirm)}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-700 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingPassword}
              >
                {loadingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tt('Updating...')}
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
