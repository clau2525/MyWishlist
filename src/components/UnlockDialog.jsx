import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOwner } from '@/lib/OwnerContext';
import { supabase } from '@/api/supabaseClient';
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function UnlockDialog({ slug, name, open, onOpenChange }) {
  const { unlock } = useOwner();
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Look up the account for this list so password managers (Apple Passwords) can match the
  // saved login: they need a username field next to the password field.
  useEffect(() => {
    if (!open || !slug) return;
    let alive = true;
    supabase
      .rpc('wishlist_login_email', { p_slug: slug })
      .then(({ data }) => alive && setLoginEmail(data || ''));
    return () => {
      alive = false;
    };
  }, [open, slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Read straight from the field so whatever autofill put in is used as-is.
    const password = e.currentTarget.elements.password.value;
    if (!password) return;
    setBusy(true);
    try {
      await unlock(slug, password);
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    // Non-modal: a modal dialog blocks clicks everywhere outside it, which includes the
    // Apple Passwords / iCloud Passwords suggestion card, so it couldn't be clicked.
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80" aria-hidden="true" onClick={() => onOpenChange(false)} />
      )}
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Unlock editing
          </DialogTitle>
          <DialogDescription>
            Enter the password for {name} to add and edit items. This browser will stay unlocked.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" method="post" action="#">
          {/* Hidden username so Apple Passwords knows which saved login this is. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={loginEmail}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Unlock
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
