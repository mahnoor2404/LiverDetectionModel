import {
  collection, addDoc, setDoc, updateDoc, doc,
  query, where, orderBy, getDocs, getDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { PredictionResult, MetricsData, ScanRecord } from './types'

// ─── Save user profile on register ─────────────────────────────────────────
export async function saveUserProfile(
  userId: string,
  name: string,
  email: string,
  role: 'doctor' | 'radiologist'
) {
  await setDoc(doc(db, 'users', userId), {
    uid: userId, name, email, role,
    createdAt: serverTimestamp(),
  })
}

// ─── Get user profile ───────────────────────────────────────────────────────
export async function getUserProfile(userId: string) {
  const snap = await getDoc(doc(db, 'users', userId))
  if (!snap.exists()) return null
  return snap.data() as { name: string; email: string; role: string }
}

// ─── Save scan result ───────────────────────────────────────────────────────
export async function saveScan(
  userId: string,
  filename: string,
  result: PredictionResult
): Promise<string> {
  const fileType = filename.toLowerCase().endsWith('.nii') ||
                   filename.toLowerCase().endsWith('.nii.gz')
                   ? 'nifti' : 'image'

  const docRef = await addDoc(collection(db, 'scans'), {
    userId,
    filename,
    fileType,
    timestamp: serverTimestamp(),
    result: {
      prediction:          result.prediction,
      resultClass:         result.result_class,
      tumorProbability:    result.tumor_probability,
      nonTumorProbability: result.non_tumor_probability,
      slicesAnalyzed:      result.slices_analyzed      ?? null,
      affectedSlices:      result.affected_slices      ?? null,
      affectedRatio:       result.affected_ratio        ?? null,
      maxProbability:      result.max_probability       ?? null,
      meanProbability:     result.mean_probability      ?? null,
      decisionReason:      result.decision_reason       ?? null,
    },
  })
  return docRef.id
}

// ─── Save evaluation (ground truth) ────────────────────────────────────────
export async function saveEvaluation(
  scanId: string,
  actualClass: 'tumor' | 'non-tumor',
  predictedClass: 'tumor' | 'non-tumor'
) {
  await updateDoc(doc(db, 'scans', scanId), {
    evaluation: {
      actualClass,
      isCorrect:   actualClass === predictedClass,
      submittedAt: serverTimestamp(),
    },
  })
}

// ─── Get scan history for a user ───────────────────────────────────────────
export async function getScanHistory(userId: string): Promise<ScanRecord[]> {
  const q = query(
    collection(db, 'scans'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id:         d.id,
      userId:     data.userId,
      filename:   data.filename,
      fileType:   data.fileType,
      timestamp:  (data.timestamp as Timestamp)?.toDate() ?? new Date(),
      result: {
        prediction:          data.result.prediction,
        result_class:        data.result.resultClass,
        tumor_probability:   data.result.tumorProbability,
        non_tumor_probability: data.result.nonTumorProbability,
        slices_analyzed:     data.result.slicesAnalyzed,
        affected_slices:     data.result.affectedSlices,
        affected_ratio:      data.result.affectedRatio,
        max_probability:     data.result.maxProbability,
        mean_probability:    data.result.meanProbability,
        decision_reason:     data.result.decisionReason,
      },
      evaluation: data.evaluation ?? null,
    } as ScanRecord
  })
}

// ─── Get single scan ────────────────────────────────────────────────────────
export async function getScanById(scanId: string): Promise<ScanRecord | null> {
  const snap = await getDoc(doc(db, 'scans', scanId))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id:        snap.id,
    userId:    data.userId,
    filename:  data.filename,
    fileType:  data.fileType,
    timestamp: (data.timestamp as Timestamp)?.toDate() ?? new Date(),
    result: {
      prediction:            data.result.prediction,
      result_class:          data.result.resultClass,
      tumor_probability:     data.result.tumorProbability,
      non_tumor_probability: data.result.nonTumorProbability,
      slices_analyzed:       data.result.slicesAnalyzed,
      affected_slices:       data.result.affectedSlices,
      affected_ratio:        data.result.affectedRatio,
      max_probability:       data.result.maxProbability,
      mean_probability:      data.result.meanProbability,
      decision_reason:       data.result.decisionReason,
    },
    evaluation: data.evaluation ?? null,
  } as ScanRecord
}

// ─── Calculate personal metrics from Firestore ─────────────────────────────
export async function getPersonalMetrics(userId: string): Promise<MetricsData> {
  const scans = await getScanHistory(userId)
  const evaluated = scans.filter(s => s.evaluation)

  let tp = 0, tn = 0, fp = 0, fn = 0
  for (const s of evaluated) {
    const pred   = s.result.result_class
    const actual = s.evaluation!.actualClass
    if (pred === 'tumor'     && actual === 'tumor')     tp++
    if (pred === 'non-tumor' && actual === 'non-tumor') tn++
    if (pred === 'tumor'     && actual === 'non-tumor') fp++
    if (pred === 'non-tumor' && actual === 'tumor')     fn++
  }

  const total     = tp + tn + fp + fn
  const accuracy  = total > 0 ? ((tp + tn) / total) * 100 : 0
  const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0
  const recall    = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0
  const specificity = (tn + fp) > 0 ? (tn / (tn + fp)) * 100 : 0
  const f1 = (precision + recall) > 0
    ? (2 * precision * recall) / (precision + recall) : 0

  return {
    accuracy, precision, recall, specificity, f1_score: f1,
    total_samples: total,
    true_positives: tp, true_negatives: tn,
    false_positives: fp, false_negatives: fn,
  }
}
