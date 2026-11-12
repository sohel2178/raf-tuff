'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, m } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Wordmark } from '@/components/AppShell';
import { ShakeOn, Stamp } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EASE_OUT, feed, unfold } from '@/lib/motion';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  useEffect(() => {
    if (status === 'authed') router.replace(dest);
  }, [status, router, dest]);

  // Until React has hydrated, a click would do a native form submit. Keep the button off until then.
  const [ready, setReady] = useState(false);
  const [jolt, setJolt] = useState(0);
  useEffect(() => setReady(true), []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await login(email, password);
      router.replace(dest);
    } catch (e) {
      setError('root', { message: e instanceof ApiError ? e.message : 'Could not sign in. Try again.' });
      setJolt((n) => n + 1);
    }
  });

  return (
    // method=post: even a pre-hydration native submit never puts credentials in the URL
    <form onSubmit={onSubmit} method="post" noValidate>
      <ShakeOn trigger={jolt} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="username" inputMode="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <AnimatePresence initial={false}>
        {errors.root && (
          <m.div key="err" {...unfold} className="overflow-hidden">
            <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-[#8d1424]" role="alert">
              {errors.root.message}
            </p>
          </m.div>
        )}
      </AnimatePresence>
      <Button type="submit" size="lg" loading={isSubmitting} disabled={!ready} className="mt-2">
        Sign in
      </Button>
      </ShakeOn>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-flag-deep px-14 py-12 text-white lg:flex lg:flex-col">
        <Wordmark className="text-2xl [&>span]:text-[#9fe0c6]" />
        <div className="mt-auto max-w-md">
          <p className="font-display text-[44px] leading-[1.05] font-extrabold tracking-[-0.03em]">
            Every taka sent,
            <br />
            every number answered for.
          </p>
          <p className="mt-5 text-[17px] leading-relaxed text-white/75">
            Recharge any Bangladeshi number, follow it until the operator confirms, and see where the day&apos;s money went.
          </p>
        </div>
        <ReceiptDecor />
      </section>
      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="text-2xl lg:hidden" />
          <h1 className="mt-8 font-display text-3xl font-extrabold tracking-[-0.02em] lg:mt-0">Sign in</h1>
          <p className="mt-1 mb-8 text-muted">Use the email your admin set up for you.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-sm text-muted">Forgot your password? Ask an admin to reset it.</p>
        </div>
      </section>
    </main>
  );
}

function ReceiptDecor() {
  const rows: [string, string][] = [
    ['017 1234 5678', '৳50'],
    ['018 9876 5432', '৳20'],
    ['019 5555 0101', '৳100'],
  ];
  const line = { hidden: { opacity: 0, y: -4 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } } };
  return (
    <m.div
      aria-hidden
      className="absolute top-14 right-14 w-64 rotate-[4deg]"
      variants={feed}
      initial="hidden"
      animate="show"
    >
      <m.div
        className="receipt px-5 py-6 text-ink"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { delayChildren: 0.35, staggerChildren: 0.12 } } }}
      >
        <m.p variants={line} className="text-center font-display font-bold">
          Recharge slip
        </m.p>
        <div className="receipt-rule my-3" />
        {rows.map(([n, a]) => (
          <m.div key={n} variants={line} className="flex justify-between py-1 text-sm tabular">
            <span>{n}</span>
            <span className="font-medium">{a}</span>
          </m.div>
        ))}
        <div className="receipt-rule my-3" />
        <m.div variants={line} className="flex justify-between text-sm font-semibold tabular">
          <span>Total</span>
          <span>৳170</span>
        </m.div>
        <div className="mt-4">
          <Stamp stampKey="paid" delay={1.2} className="rounded border-2 border-flag px-2 py-0.5 text-sm font-bold text-flag">
            PAID
          </Stamp>
        </div>
      </m.div>
    </m.div>
  );
}
