import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/app/_components/AuthLayout";
import { authAppearance } from "@/app/_components/clerkAppearance";

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
        appearance={authAppearance}
      />
    </AuthLayout>
  );
}
