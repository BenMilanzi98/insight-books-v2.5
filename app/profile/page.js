"use client";
import { useEffect, useState } from "react";

export default function Profile() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: ""
  });

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
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
      body: JSON.stringify({ profile })
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

    // client-side validation
    let clientErrors = {};
    if (!currentPassword) clientErrors.currentPassword = "Current password is required";
    if (!newPassword) clientErrors.newPassword = "New password is required";
    if (!confirmPassword) clientErrors.confirmPassword = "Please confirm your new password";
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
      body: JSON.stringify({ passwordUpdate: passwords })
    });

    setLoadingPassword(false);

    if (res.ok) {
      setPasswordMsg("Password updated successfully");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } else {
      const error = await res.json();
      setPasswordMsg(error.message || "Failed to update password");
      if (error.errors) setPasswordErrors(error.errors);
    }
  };

  return (
    <main className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>

      <form onSubmit={saveProfile} className="space-y-4 mb-8">
        {profileMsg && <p className="text-sm text-red-500">{profileMsg}</p>}

        <div>
          <label className="block mb-1">Name</label>
          <input
            name="name"
            value={profile.name || ""}
            onChange={handleProfileChange}
            className={`w-full border rounded p-2 ${errors.name ? "border-red-500" : ""}`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block mb-1">Email (read-only)</label>
          <input
            value={profile.email || ""}
            disabled
            className="w-full border rounded p-2 bg-gray-100"
          />
        </div>
        <div>
          <label className="block mb-1">Phone</label>
          <input
            name="phone"
            value={profile.phone || ""}
            onChange={handleProfileChange}
            className={`w-full border rounded p-2 ${errors.phone ? "border-red-500" : ""}`}
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className="block mb-1">Role(read-only)</label>
          <input
            value={profile.role || ""}
            disabled
            className="w-full border rounded p-2 bg-gray-100"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center"
          disabled={loadingProfile}
        >
          {loadingProfile ? "Saving..." : "Save Profile"}
        </button>
      </form>

      <h2 className="text-xl font-bold mb-2">Update Password</h2>
      <form onSubmit={updatePassword} className="space-y-4">
        {passwordMsg && <p className="text-sm text-red-500">{passwordMsg}</p>}

        <div>
          <label className="block mb-1">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              name="currentPassword"
              value={passwords.currentPassword}
              onChange={handlePasswordChange}
              className={`w-full border rounded p-2 pr-10 ${passwordErrors.currentPassword ? "border-red-500" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-600"
            >
              {showCurrent ? "🙈" : "👁"}
            </button>
          </div>
          {passwordErrors.currentPassword && (
            <p className="text-xs text-red-500 mt-1">{passwordErrors.currentPassword}</p>
          )}
        </div>

        <div>
          <label className="block mb-1">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              name="newPassword"
              value={passwords.newPassword}
              onChange={handlePasswordChange}
              className={`w-full border rounded p-2 pr-10 ${passwordErrors.newPassword ? "border-red-500" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-600"
            >
              {showNew ? "🙈" : "👁"}
            </button>
          </div>
          {passwordErrors.newPassword && (
            <p className="text-xs text-red-500 mt-1">{passwordErrors.newPassword}</p>
          )}
        </div>

        <div>
          <label className="block mb-1">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              value={passwords.confirmPassword}
              onChange={handlePasswordChange}
              className={`w-full border rounded p-2 pr-10 ${passwordErrors.confirmPassword ? "border-red-500" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-600"
            >
              {showConfirm ? "🙈" : "👁"}
            </button>
          </div>
          {passwordErrors.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">{passwordErrors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center"
          disabled={loadingPassword}
        >
          {loadingPassword ? "Updating..." : "Update Password"}
        </button>
      </form>

    </main>
  );
}
