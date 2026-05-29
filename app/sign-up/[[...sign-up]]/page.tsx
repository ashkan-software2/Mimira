import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/app/_components/AuthLayout";
import { authAppearance } from "@/app/_components/clerkAppearance";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
        appearance={authAppearance}
      />
    </AuthLayout>
  );
}
