import { useState, useEffect } from 'react';
import { RefreshCw, Download, CheckCircle2, AlertTriangle, GitBranch, GitCommit, Clock, Server, HardDrive, Loader2 } from 'lucide-react';
import { systemAPI, backupAPI } from '../../lib/api';
import type { VersionInfo, UpdateCheck } from '../../lib/api';
import { useToast } from '../../hooks/useToast';

interface DBStats {
  accounts: number;
  transactions: number;
  postings: number;
  size: number;
}

export function AboutTab() {
  const { showSuccess, showError } = useToast();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheck | null>(null);
  const [dbStats, setDBStats] = useState<DBStats | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateComplete, setUpdateComplete] = useState(false);

  useEffect(() => {
    loadVersionInfo();
    loadDBStats();
  }, []);

  const loadVersionInfo = async () => {
    setLoadingVersion(true);
    try {
      const info = await systemAPI.getVersion();
      setVersionInfo(info);
    } catch (error) {
      console.error('Failed to load version info:', error);
    } finally {
      setLoadingVersion(false);
    }
  };

  const loadDBStats = async () => {
    try {
      const stats = await backupAPI.getStats();
      setDBStats(stats);
    } catch (error) {
      console.error('Failed to load DB stats:', error);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateCheck(null);
    try {
      const result = await systemAPI.checkUpdate();
      setUpdateCheck(result);
      if (!result.updateAvailable) {
        showSuccess('Up to date', 'You are running the latest version');
      }
    } catch (error) {
      showError('Update check failed', (error as Error).message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const result = await systemAPI.performUpdate();
      if (result.success) {
        setUpdateComplete(true);
        setUpdateCheck(null);
        showSuccess('Update complete', `Updated to v${result.newVersion} (${result.newHash}). Please restart the server.`);
      }
    } catch (error) {
      showError('Update failed', (error as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* App Identity */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-3xl font-bold text-white">L</span>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ledgerhound</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Personal & Small-Business Ledger for Australia
            </p>
            {loadingVersion ? (
              <div className="flex items-center gap-2 mt-3">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-400">Loading version info...</span>
              </div>
            ) : versionInfo ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full font-semibold">
                    v{versionInfo.version}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <GitCommit className="w-3.5 h-3.5" />
                    {versionInfo.gitHash}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <GitBranch className="w-3.5 h-3.5" />
                    {versionInfo.gitBranch}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3" />
                  Last commit: {formatDate(versionInfo.lastCommitDate)}
                  <span className="text-slate-400 dark:text-slate-500 ml-1">
                    — {versionInfo.lastCommitMessage}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-500 mt-3">Failed to load version info</p>
            )}
          </div>
        </div>
      </div>

      {/* Updates */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Software Updates</h3>

        {updateComplete ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-200">Update installed successfully</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                  Please restart the API server to apply changes. Stop the current server and run <code className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 rounded text-xs font-mono">npm run api</code> again.
                </p>
              </div>
            </div>
          </div>
        ) : updateCheck?.updateAvailable ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Update available — {updateCheck.behindBy} commit{updateCheck.behindBy !== 1 ? 's' : ''} behind
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Latest: <span className="font-mono">{updateCheck.remoteHash}</span>
                  {updateCheck.latestCommitMessage && (
                    <span className="ml-1">— {updateCheck.latestCommitMessage}</span>
                  )}
                </p>
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Update Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : updateCheck && !updateCheck.updateAvailable ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="font-medium text-emerald-800 dark:text-emerald-200">You're up to date</p>
            </div>
          </div>
        ) : null}

        {!updateComplete && (
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {checkingUpdate ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Check for Updates
              </>
            )}
          </button>
        )}
      </div>

      {/* System Info */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">System Information</h3>

        <div className="space-y-3">
          {versionInfo && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">Node.js:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{versionInfo.nodeVersion}</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">Platform:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{versionInfo.platform}</span>
              </div>
            </div>
          )}

          {dbStats && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Database</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Accounts:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{dbStats.accounts}</span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Transactions:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{dbStats.transactions}</span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Postings:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{dbStats.postings}</span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Database Size:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{formatBytes(dbStats.size)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
