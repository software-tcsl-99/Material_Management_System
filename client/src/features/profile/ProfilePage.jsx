import React, { useState, useRef } from 'react';
import { User, Phone, Mail, MapPin, Building, Briefcase, Camera, Save, KeyRound, CheckCircle2, Calendar, ShieldAlert } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../lib/axios';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const fileInputRef = useRef(null);

  // Profile Details State
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Photo State
  const [photoUploading, setPhotoUploading] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      const response = await api.put('/employees/profile/update', { fullName, email, phone });
      updateUser(response.data.user || response.data.data);
      setProfileSuccess('Profile details saved successfully.');
    } catch (err) {
      console.error(err);
      setProfileError(err.response?.data?.message || 'Failed to update contact details.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }
    setUpdatingPassword(true);
    setPasswordSuccess('');
    setPasswordError('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordSuccess('Security credentials updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setPasswordError(err.response?.data?.message || 'Failed to change password. Verify your current password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setPhotoUploading(true);
    setProfileError('');
    try {
      const response = await api.post('/employees/profile/photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const photoUrl = response.data.url || response.data.profilePhoto;
      updateUser({ profilePhoto: photoUrl });
      setProfileSuccess('Profile photo updated successfully.');
    } catch (err) {
      console.error(err);
      setProfileError('Failed to upload profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const getJoiningDateString = () => {
    if (!user?.joiningDate) return 'N/A';
    try {
      return new Date(user.joiningDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Cover Header Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-32 sm:h-48 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 relative">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/10 dark:from-slate-900/40" />
        </div>
        
        {/* Floating User Summary */}
        <div className="px-6 pb-6 pt-16 sm:pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative">
          
          {/* Avatar Container */}
          <div className="absolute -top-16 sm:-top-20 left-6 sm:left-10 group">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 shadow-2xl relative flex items-center justify-center text-slate-400 font-extrabold text-4xl select-none group-hover:scale-105 transition-transform duration-300">
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-indigo-600 dark:text-indigo-400">{user?.fullName?.charAt(0) || 'U'}</span>
              )}
              
              {/* Photo Overlay Upload trigger */}
              <button
                disabled={photoUploading}
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white cursor-pointer text-[10px] sm:text-xs font-semibold gap-1.5"
              >
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-slate-200" />
                <span>{photoUploading ? 'Saving...' : 'Upload Photo'}</span>
              </button>
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* User Meta Information */}
          <div className="sm:ml-44 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white m-0">
                {user?.fullName}
              </h1>
              <Badge variant={['super_admin', 'admin'].includes(user?.role) ? 'default' : 'neutral'} className="h-5 text-[10px] px-2.5 font-bold uppercase tracking-wider">
                {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'System Admin' : 'Employee'}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm font-semibold font-mono text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Employee ID:</span>
              <span className="text-indigo-600 dark:text-indigo-400 select-all font-bold">{user?.employeeId}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Corporate Assignments */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-5 glass animate-in slide-in-from-left-4 duration-300">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
              Corporate Node Properties
            </h3>

            {/* Department */}
            <div className="flex items-start gap-3.5 group">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Department</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {user?.department?.name || 'Unassigned Node'}
                </span>
              </div>
            </div>

            {/* Designation */}
            <div className="flex items-start gap-3.5 group">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Designation</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {user?.designation?.name || 'Unassigned Role'}
                </span>
              </div>
            </div>

            {/* Work Location */}
            <div className="flex items-start gap-3.5 group">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Work Location</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200 block truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {user?.workLocation?.name || 'Unassigned Facility'}
                </span>
                {user?.workLocation?.address && (
                  <span className="text-[11px] text-slate-500 mt-0.5 block truncate leading-normal">
                    {user.workLocation.address}
                  </span>
                )}
              </div>
            </div>

            {/* Joining Date */}
            <div className="flex items-start gap-3.5 group border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Date of Joining</span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  {getJoiningDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Profile forms */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Global Alert Notification */}
          {(profileSuccess || profileError) && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in slide-in-from-top-4 duration-300 ${
              profileSuccess 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
            }`}>
              {profileSuccess ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />}
              <div className="text-xs font-semibold leading-relaxed">
                {profileSuccess || profileError}
              </div>
            </div>
          )}

          {/* Combined Contact & Credentials Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white m-0">Account Settings</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Manage your notification contact channels and system credentials in one box
              </p>
            </div>

            {/* Section 1: Contact details */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Personal & Contact Channels</h3>
              <form onSubmit={handleProfileUpdate} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <Input
                      id="fullName"
                      label="Full Name"
                      type="text"
                      icon={User}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Input
                      id="email"
                      label="Email Address"
                      type="email"
                      icon={Mail}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Input
                      id="phone"
                      label="Phone Number"
                      type="tel"
                      icon={Phone}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-4">
                  <Button 
                    type="submit" 
                    size="sm" 
                    loading={updatingProfile} 
                    icon={Save}
                    className="px-6 shadow-md hover:shadow-lg transition-shadow"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>

            <hr className="border-slate-100 dark:border-slate-800 my-2" />

            {/* Section 2: Password change */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Credential & Integrity Config</h3>
              
              {(passwordSuccess || passwordError) && (
                <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                  passwordSuccess 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}>
                  {passwordSuccess ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
                  <span className="text-xs font-semibold">{passwordSuccess || passwordError}</span>
                </div>
              )}

              <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <Input
                    id="currentPassword"
                    label="Current Password"
                    type="password"
                    icon={KeyRound}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <Input
                    id="newPassword"
                    label="New Password"
                    type="password"
                    icon={KeyRound}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Input
                    id="confirmPassword"
                    label="Confirm New Password"
                    type="password"
                    icon={KeyRound}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-4">
                  <Button 
                    type="submit" 
                    size="sm" 
                    loading={updatingPassword} 
                    icon={Save}
                    className="px-6 shadow-md hover:shadow-lg transition-shadow"
                  >
                    Update Credentials
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
