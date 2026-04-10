import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
      <SignIn />
    </main>
  );
}
