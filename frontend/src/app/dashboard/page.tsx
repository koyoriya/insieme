export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Insieme Dashboard
            </h1>
            <p className="text-gray-600 mb-6">
              問題作成&添削システム（開発中）
            </p>
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
              <ul className="space-y-2 text-gray-600">
                <li>• LLMによる問題生成</li>
                <li>• 問題の印刷機能</li>
                <li>• PDFによる回答提出</li>
                <li>• 自動採点・フィードバック</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}