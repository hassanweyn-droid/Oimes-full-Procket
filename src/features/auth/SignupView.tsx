// ─────────────────────────────────────────────────────────────────────────────
// OIMES — SignupView
// Multi-field registration form: first name, last name, phone, email, password.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, MapPin } from 'lucide-react';
import { useAuthStore, AuthError } from './auth-store';
import { AppLogo } from '../../components/AppLogo';

interface SignupViewProps {
  onGoToLogin: () => void;
}

interface FormFields {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  city: string;
  region: string;
}

const SOMALI_REGIONS = [
  'Banaadir', 'Bay', 'Bakool', 'Bari', 'Galgaduud', 'Gedo', 'Hiiraan',
  'Jubbada Dhexe', 'Jubbada Hoose', 'Mudug', 'Nugaal', 'Sanaag',
  'Shabeellaha Dhexe', 'Shabeellaha Hoose', 'Sool', 'Togdheer', 'Woqooyi Galbeed',
] as const;

type FieldErrors = Partial<Record<keyof FormFields, string>>;

function validatePhone(phone: string): boolean {
  // Somali E.164: +252 followed by 9 digits
  return /^\+252\d{9}$/.test(phone.replace(/\s/g, ''));
}

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    return 'Password must include letters and numbers';
  return undefined;
}

export function SignupView({ onGoToLogin }: SignupViewProps) {
  const signup = useAuthStore((s) => s.signup);

  const [fields, setFields] = useState<FormFields>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    city: '',
    region: 'Banaadir',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function set(key: keyof FormFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFields((p) => ({ ...p, [key]: e.target.value }));
      setFieldErrors((p) => ({ ...p, [key]: undefined }));
      setErrorMsg('');
    };
  }

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!fields.firstName.trim()) errors.firstName = 'First name is required';
    if (!fields.lastName.trim()) errors.lastName = 'Last name is required';
    if (!fields.phone.trim()) errors.phone = 'Phone number is required';
    else if (!validatePhone(fields.phone))
      errors.phone = 'Use format +252XXXXXXXXX (Somali number)';
    if (!fields.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      errors.email = 'Enter a valid email address';
    const pwErr = validatePassword(fields.password);
    if (pwErr) errors.password = pwErr;
    if (!fields.confirmPassword) errors.confirmPassword = 'Please confirm your password';
    else if (fields.password !== fields.confirmPassword)
      errors.confirmPassword = 'Passwords do not match';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!validate()) return;

    setLoading(true);
    try {
      await signup(
        fields.firstName,
        fields.lastName,
        fields.email,
        fields.password,
        fields.phone.replace(/\s/g, ''),
        fields.city,
        fields.region
      );
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.code === 'EMAIL_ALREADY_EXISTS') {
          setFieldErrors((p) => ({ ...p, email: err.message }));
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    paddingLeft: 36,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    borderRadius: 8,
    border: `1.5px solid ${hasError ? 'var(--error-banner-border)' : 'var(--border)'}`,
    background: 'var(--input-background)',
    color: 'var(--foreground)',
    outline: 'none',
  });

  const selectStyle = (hasError: boolean): React.CSSProperties => ({
    ...inputStyle(hasError),
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    paddingLeft: 12,
  });

  return (
    <div className="flex flex-col flex-1 justify-center px-6 py-10 max-w-[400px] mx-auto w-full">
      {/* Brand mark */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: 'var(--primary)' }}>
            <AppLogo size={24} color="var(--primary-foreground)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--foreground)' }}>OIMES</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>
          Create your account
        </h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--muted-foreground)' }}>
          Exchange Somali mobile money in seconds.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        {/* Global error */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              key="err"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                background: 'var(--error-banner-bg)',
                border: '1px solid #FCA5A5',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--destructive)',
              }}
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* First + Last name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-first" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              First name
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                id="signup-first"
                type="text"
                autoComplete="given-name"
                placeholder="ENTER YOUR FIRST NAME"
                value={fields.firstName}
                onChange={set('firstName')}
                style={inputStyle(!!fieldErrors.firstName)}
                onFocus={(e) => (e.target.style.borderColor = fieldErrors.firstName ? 'var(--destructive)' : 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = fieldErrors.firstName ? 'var(--error-banner-border)' : 'var(--border)')}
              />
            </div>
            {fieldErrors.firstName && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.firstName}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-last" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              Last name
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                id="signup-last"
                type="text"
                autoComplete="family-name"
                placeholder="ENTER YOUR LAST NAME"
                value={fields.lastName}
                onChange={set('lastName')}
                style={inputStyle(!!fieldErrors.lastName)}
                onFocus={(e) => (e.target.style.borderColor = fieldErrors.lastName ? 'var(--destructive)' : 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = fieldErrors.lastName ? 'var(--error-banner-border)' : 'var(--border)')}
              />
            </div>
            {fieldErrors.lastName && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.lastName}</span>}
          </div>
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-phone" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
            Phone number
          </label>
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
            <input
              id="signup-phone"
              type="tel"
              autoComplete="tel"
              placeholder="ENTER YOUR PHONE NUMBER"
              value={fields.phone}
              onChange={set('phone')}
              style={inputStyle(!!fieldErrors.phone)}
              onFocus={(e) => (e.target.style.borderColor = fieldErrors.phone ? 'var(--destructive)' : 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = fieldErrors.phone ? 'var(--error-banner-border)' : 'var(--border)')}
            />
          </div>
          {fieldErrors.phone && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.phone}</span>}
        </div>

        {/* City + Region */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-city" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              City
            </label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                id="signup-city"
                type="text"
                placeholder="ENTER YOUR CITY"
                value={fields.city}
                onChange={set('city')}
                style={inputStyle(false)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-region" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              Region
            </label>
            <select
              id="signup-region"
              value={fields.region}
              onChange={set('region')}
              style={selectStyle(false)}
            >
              {SOMALI_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-email" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
            Email address
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="ENTER YOUR EMAIL"
              value={fields.email}
              onChange={set('email')}
              style={inputStyle(!!fieldErrors.email)}
              onFocus={(e) => (e.target.style.borderColor = fieldErrors.email ? 'var(--destructive)' : 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = fieldErrors.email ? 'var(--error-banner-border)' : 'var(--border)')}
            />
          </div>
          {fieldErrors.email && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.email}</span>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-password" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
            Password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={fields.password}
              onChange={set('password')}
              style={{ ...inputStyle(!!fieldErrors.password), paddingRight: 40 }}
              onFocus={(e) => (e.target.style.borderColor = fieldErrors.password ? 'var(--destructive)' : 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = fieldErrors.password ? 'var(--error-banner-border)' : 'var(--border)')}
            />
            <button type="button" onClick={() => setShowPassword((p) => !p)} aria-label={showPassword ? 'Hide' : 'Show'} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', padding: 4 }}>
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {fieldErrors.password && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.password}</span>}
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-confirm" style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
            Confirm password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
            <input
              id="signup-confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={fields.confirmPassword}
              onChange={set('confirmPassword')}
              style={{ ...inputStyle(!!fieldErrors.confirmPassword), paddingRight: 40 }}
              onFocus={(e) => (e.target.style.borderColor = fieldErrors.confirmPassword ? 'var(--destructive)' : 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = fieldErrors.confirmPassword ? 'var(--error-banner-border)' : 'var(--border)')}
            />
            <button type="button" onClick={() => setShowConfirm((p) => !p)} aria-label={showConfirm ? 'Hide' : 'Show'} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', padding: 4 }}>
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {fieldErrors.confirmPassword && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.confirmPassword}</span>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 4,
            paddingTop: 11,
            paddingBottom: 11,
            borderRadius: 8,
            background: loading ? 'var(--muted)' : 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, opacity 0.15s',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <><Loader2 size={15} className="animate-spin" /> Creating account…</>
          ) : (
            <>Create account <ArrowRight size={15} /></>
          )}
        </button>

        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.5 }}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.form>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}
      >
        Already have an account?{' '}
        <button
          type="button"
          onClick={onGoToLogin}
          style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, fontSize: 13, color: 'var(--foreground)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Sign in
        </button>
      </motion.p>
    </div>
  );
}
