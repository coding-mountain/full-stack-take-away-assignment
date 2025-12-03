import { useState, useMemo, useRef } from "react";
import {
  Upload,
  FileText,
  BarChart3,
  Calendar,
  Search,
  UploadCloud,
  Database,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// parse
const parseSeismicData = (text) => {
  const lines = text.split(/\r?\n/);
  const dataStore = {};
  const errors = [];

  lines.forEach((line, lineIdx) => {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length === 0 || tokens[0] === "") return;

    let currentDateKey = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "-999") break;

      if (/^\d{8}$/.test(token)) {
        const year = parseInt(token.substring(0, 4));
        const month = parseInt(token.substring(4, 6));
        const day = parseInt(token.substring(6, 8));

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          currentDateKey = `${year}-${String(month).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;
          if (!dataStore[currentDateKey]) dataStore[currentDateKey] = [];
        } else {
          currentDateKey = null;
          errors.push(`Line ${lineIdx + 1}: Invalid date skipped (${token})`);
        }
      } else {
        const val = parseFloat(token);
        if (!isNaN(val) && currentDateKey && val > 0 && val < 1000) {
          dataStore[currentDateKey].push(val);
        }
      }
    }
  });

  return { dataStore, errors };
};

export default function App() {
  const [view, setView] = useState("input");

  // local state
  const [inputText, setInputText] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);

  // from db
  const [dataSource, setDataSource] = useState("local");
  const [dbData, setDbData] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  // ui
  const [filterType, setFilterType] = useState("day");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const fileInputRef = useRef(null);

  // --- functions ---
  const handleFileSelect = (event) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") setInputText(text);
      };
      reader.readAsText(file);
    }
  };

  const processAndUpload = async () => {
    setIsUploading(true);
    setUploadStatus("idle");

    const { dataStore, errors } = parseSeismicData(inputText);
    setParsedData(dataStore);
    setParseErrors(errors);
    setDataSource("local");

    const formData = new FormData();
    if (selectedFile) formData.append("file", selectedFile);
    else
      formData.append(
        "file",
        new Blob([inputText], { type: "text/plain" }),
        "manual.txt"
      );

    try {
      const response = await fetch("http://localhost:9797/api/load-data", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Server upload failed");
      setUploadStatus("success");
      setTimeout(() => setView("stats"), 1000);
    } catch (error) {
      console.warn("Backend unavailable (expected in demo). Using local data.");
      setUploadStatus("error");
      setTimeout(() => setView("stats"), 800);
    } finally {
      setIsUploading(false);
    }
  };

  // --- fetch data ---
  const fetchFromDb = async (page = 1, search = "") => {
    setDbLoading(true);
    try {
      let url = `http://localhost:9797/api/stats/daily?page=${page}&limit=${pagination.limit}`;
      let singleResult = false;

      if (search && /^\d{4}-\d{2}-\d{2}$/.test(search)) {
        const [y, m, d] = search.split("-");
        url = `http://localhost:9797/api/stats/day/${y}/${m}/${d}`;
        singleResult = true;
      } else if (search && /^\d{4}-\d{2}$/.test(search)) {
        const [y, m] = search.split("-");
        url = `http://localhost:9797/api/stats/month/${y}/${m}`;
        singleResult = true;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const json = await res.json();

      if (singleResult) {
        setDbData([
          {
            date: json.period,
            min: json.min,
            max: json.max,
            count: json.count,
          },
        ]);
        setPagination((prev) => ({ ...prev, page: 1, totalPages: 1 }));
      } else {
        setDbData(json.data);
        setPagination((prev) => ({
          ...prev,
          page: json.meta.page,
          totalPages: json.meta.totalPages,
        }));
      }
      setDataSource("database");
    } catch (err) {
      console.error(err);
      alert("Could not fetch from database. Is the server running?");
    } finally {
      setDbLoading(false);
    }
  };

  const handleDbSync = () => {
    setDataSource("database");
    fetchFromDb(1, searchTerm);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchFromDb(newPage, searchTerm);
  };

  const handleSearch = () => {
    if (dataSource === "database") {
      fetchFromDb(1, searchTerm);
    }
  };

  const localStats = useMemo(() => {
    if (!parsedData) return [];

    const daily = Object.keys(parsedData).map((date) => {
      const readings = parsedData[date];
      return {
        date,
        min: Math.min(...readings),
        max: Math.max(...readings),
        count: readings.length,
        readings,
      };
    });

    let filtered = daily.filter((d) => d.date.includes(searchTerm));
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    if (filterType === "month") {
      // Group by month
      const monthMap = {};
      filtered.forEach((d) => {
        const mKey = d.date.substring(0, 7);
        if (!monthMap[mKey]) {
          monthMap[mKey] = {
            date: mKey,
            min: Infinity,
            max: -Infinity,
            count: 0,
            readings: [],
          };
        }
        monthMap[mKey].min = Math.min(monthMap[mKey].min, d.min);
        monthMap[mKey].max = Math.max(monthMap[mKey].max, d.max);
        monthMap[mKey].count += d.count;
      });
      return Object.values(monthMap).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    }

    return filtered;
  }, [parsedData, searchTerm, filterType]);

  const displayData = dataSource === "database" ? dbData : localStats;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-blue-900 text-white p-6 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-700 p-2 rounded-lg">
              <BarChart3 size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              GeoSeis Analytics
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* nav */}
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button
            onClick={() => setView("input")}
            className={`pb-3 px-4 font-medium flex items-center gap-2 transition-colors ${
              view === "input"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Upload size={18} /> Load Data
          </button>
          <button
            onClick={() => setView("stats")}
            className={`pb-3 px-4 font-medium flex items-center gap-2 transition-colors ${
              view === "stats"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText size={18} /> View Statistics
          </button>
        </div>

        {/* --- input --- */}
        {view === "input" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">
              Upload Sensor Data
            </h2>
            <div
              className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-300 hover:border-blue-400"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt"
                onChange={handleFileSelect}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={32} className="text-blue-600" />
                  <p className="font-medium">{selectedFile.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadCloud size={32} className="text-slate-400" />
                  <p className="font-medium text-slate-700">
                    Click to upload or drag .txt file
                  </p>
                </div>
              )}
            </div>

            <textarea
              className="w-full h-32 p-4 font-mono text-sm border border-slate-300 rounded-lg mb-4 bg-slate-50"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Preview data..."
              disabled={true}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={processAndUpload}
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
              >
                {isUploading ? (
                  "Processing..."
                ) : (
                  <>
                    <Database size={18} /> Upload & Process
                  </>
                )}
              </button>
            </div>
            {uploadStatus === "error" && (
              <p className="mt-4 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                Backend unreachable. Showing local results.
              </p>
            )}
          </div>
        )}

        {/* --- stats --- */}
        {view === "stats" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              {/* toggle source */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600 mr-2">
                  Source:
                </span>
                <button
                  onClick={() => setDataSource("local")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                    dataSource === "local"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Local Upload
                </button>
                <button
                  onClick={handleDbSync}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border flex items-center gap-2 ${
                    dataSource === "database"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  <RefreshCw
                    size={14}
                    className={dbLoading ? "animate-spin" : ""}
                  />
                  Fetch from DB
                </button>
              </div>

              {/* search and filter */}
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setFilterType("day")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                      filterType === "day"
                        ? "bg-white shadow-sm text-blue-900"
                        : "text-slate-500"
                    }`}
                  >
                    By Date
                  </button>
                  <button
                    onClick={() => setFilterType("month")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                      filterType === "month"
                        ? "bg-white shadow-sm text-blue-900"
                        : "text-slate-500"
                    }`}
                  >
                    By Month
                  </button>
                </div>

                <div className="relative grow lg:grow-0">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder={
                      dataSource === "database"
                        ? filterType === "day"
                          ? "YYYY-MM-DD (Enter to search)"
                          : "YYYY-MM (Enter to search)"
                        : "Filter results..."
                    }
                    className="w-full lg:w-64 pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>
            </div>

            {/* table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm">
                      Period
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm text-right">
                      Min Freq (Hz)
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm text-right">
                      Max Freq (Hz)
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-700 text-sm text-right">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayData.length > 0 ? (
                    displayData.map((stat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900 font-medium flex items-center gap-2">
                          <Calendar size={16} className="text-slate-400" />
                          {stat.date || stat.monthKey}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-right">
                          {stat.min}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-right">
                          {stat.max}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-right">
                          <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold">
                            {stat.count || stat.totalCount}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-slate-400"
                      >
                        No data found.{" "}
                        {dataSource === "database" &&
                          "Try searching for a specific date (YYYY-MM-DD)."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* pagination control */}
            {dataSource === "database" && (
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
