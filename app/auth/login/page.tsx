import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

function getSafeNextPath(value: string | string[] | undefined) {
  const nextPath = Array.isArray(value) ? value[0] : value;

  if (!nextPath) return "/troop";

  try {
    const baseUrl = new URL("https://trinket-troop.invalid");
    const targetUrl = new URL(nextPath, baseUrl);

    return targetUrl.origin === baseUrl.origin
      ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
      : "/troop";
  } catch {
    return "/troop";
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm nextPath={getSafeNextPath(next)} />
      </div>
    </div>
  );
}
