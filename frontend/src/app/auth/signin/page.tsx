export default function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Insieme
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Firebase Authentication will be integrated soon
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-blue-800 text-sm text-center">
              Authentication system under development
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}