'use client'
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { auth, db } from './firebase/config';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import Statistics from './components/Statistics';

export default function Home() {
  const [user, setUser] = useState(null);
  const [medications, setMedications] = useState([]);
  const [newMed, setNewMed] = useState({
    name: '',
    dosage: '',
    frequency: '',
    timesPerDay: 1,
    times: [''],
    startDate: '',
    endDate: ''
  });

  const [logs, setLogs] = useState({});
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        loadMedications(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const setupNotifications = async () => {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
      }
      setPermission(Notification.permission);
    };
    setupNotifications();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setMedications([]);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const loadMedications = async (userId) => {
    try {
      const medicationsRef = collection(db, 'users', userId, 'medications');
      const querySnapshot = await getDocs(medicationsRef);
      const meds = [];
      querySnapshot.forEach((doc) => {
        meds.push({ id: doc.id, ...doc.data() });
      });
      setMedications(meds);
    } catch (error) {
      console.error('Error loading medications:', error);
    }
  };

  const generateDatesBetween = (startDate, endDate, frequency) => {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      
      switch (frequency) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        default:
          current.setDate(current.getDate() + 1);
      }
    }
    return dates;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      const medId = Date.now().toString();
      
      // First, create or get the user document
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: user.email,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // Create logs object
      const dates = generateDatesBetween(newMed.startDate, newMed.endDate, newMed.frequency);
      const logs = {};
      dates.forEach(date => {
        logs[date] = {};
        newMed.times.forEach(time => {
          if (time && time.trim() !== '') {
            logs[date][time] = 'pending';
          }
        });
      });

      // Create medication document in the medications subcollection
      const medRef = doc(db, 'users', user.uid, 'medications', medId);
      const medData = {
        name: newMed.name,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        timesPerDay: newMed.timesPerDay,
        times: newMed.times.filter(time => time && time.trim() !== ''),

        startDate: newMed.startDate,
        endDate: newMed.endDate,
        createdAt: new Date().toISOString(),
        logs: logs
      };

      await setDoc(medRef, medData);

      // Update loadMedications function to handle subcollection
      await loadMedications(user.uid);
      
      // Reset form
      setNewMed({
        name: '',
        dosage: '',
        frequency: '',
        timesPerDay: 1,
        times: [''],
        startDate: '',
        endDate: ''
      });

    } catch (error) {
      console.error('Error adding medication:', error);
      alert('Error adding medication: ' + error.message);
    }
  };

  const updateMedicationStatus = async (medId, time, date, status) => {
    try {
      const medRef = doc(db, 'users', user.uid, 'medications', medId);
      const medData = {
        logs: {
          [date]: {
            [time]: status
          }
        }
      };
      await setDoc(medRef, medData, { merge: true });
      await loadMedications(user.uid);
    } catch (error) {
      console.error('Error updating medication status:', error);
    }
  };

  const deleteMedication = async (medId) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'medications', medId));
      await loadMedications(user.uid);
    } catch (error) {
      console.error('Error deleting medication:', error);
    }
  };

  const handleTimesPerDayChange = (e) => {
    const count = parseInt(e.target.value) || 1;
    setNewMed({
      ...newMed,
      timesPerDay: count,
      times: Array(count).fill('')
    });
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...newMed.times];
    newTimes[index] = value || '00:00';
    setNewMed({...newMed, times: newTimes});
  };

  const initializeTodayLogs = async (medId, times) => {
    const today = new Date().toISOString().split('T')[0];
    const medRef = doc(db, 'users', user.uid, 'medications', medId);

    try {
      await setDoc(medRef, {
        logs: {
          [today]: times.reduce((acc, time) => {
            acc[time] = 'pending';
            return acc;
          }, {})
        }
      }, { merge: true });
      await loadMedications(user.uid);
    } catch (error) {
      console.error('Error initializing today\'s logs:', error);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      await Notification.requestPermission();
      setPermission('granted');
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (window.medicationTimeouts) {
        window.medicationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        window.medicationTimeouts = [];
      }
    };
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="bg-white shadow-2xl rounded-3xl p-12 text-center max-w-md w-full">
          <div className="mb-8">
            <Image
              src="/MediPing.png"
              alt="MediPing Logo"
              width={64}
              height={64}
              className="mx-auto"
              priority
            />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            MediPing
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Your smart medication reminder companion
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-3xl p-8 mb-8 border border-white/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden">
                <Image
                  src="/MediPing.png"
                  alt="MediPing Logo"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  MediPing
                </h1>
                <p className="text-gray-600">Smart medication tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Welcome back</p>
                <p className="font-semibold text-gray-700">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
        
        {/* Statistics Component */}
        <div className="mb-8">
          <Statistics medications={medications} />
        </div>
        
        {/* Add Medication Form */}
        <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-3xl p-8 mb-8 border border-white/20">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center text-white">+</span>
            Add New Medication
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Medication Name</label>
                <input
                  type="text"
                  placeholder="Enter medication name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  value={newMed.name}
                  onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dosage</label>
                <input
                  type="text"
                  placeholder="e.g., 500mg, 2 tablets"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  value={newMed.dosage}
                  onChange={(e) => setNewMed({...newMed, dosage: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Frequency</label>
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  value={newMed.frequency}
                  onChange={(e) => setNewMed({...newMed, frequency: e.target.value})}
                >
                  <option value="">Select frequency</option>
                  <option value="daily">📅 Daily</option>
                  <option value="weekly">📆 Weekly</option>
                  <option value="monthly">🗓️ Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Times per day</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  value={newMed.timesPerDay}
                  onChange={handleTimesPerDayChange}
                />
              </div>
            </div>

            {newMed.times.map((time, index) => (
              <div key={index}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ⏰ Time {index + 1}
                </label>
                <input
                  type="time"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  value={time}
                  onChange={(e) => handleTimeChange(index, e.target.value)}
                />
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  value={newMed.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNewMed({...newMed, startDate: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  value={newMed.endDate}
                  min={newMed.startDate}
                  onChange={(e) => setNewMed({...newMed, endDate: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              Add Medication
            </button>
          </form>
        </div>

        {/* Medications List */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white">📋</span>
            Your Medications
          </h2>
          
          {medications.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-3xl p-12 text-center border border-white/20">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl text-gray-400">💊</span>
              </div>
              <p className="text-gray-500 text-lg">No medications added yet</p>
              <p className="text-gray-400">Add your first medication to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {medications.map((med) => {
                const today = new Date().toISOString().split('T')[0];
                const todayLogs = med.logs?.[today];

                if (!todayLogs) {
                  initializeTodayLogs(med.id, med.times);
                  return null;
                }

                const takenCount = Object.values(todayLogs).filter(status => status === 'taken').length;
                const missedCount = Object.values(todayLogs).filter(status => status === 'missed').length;
                const pendingCount = Object.values(todayLogs).filter(status => status === 'pending').length;
                const totalTimes = med.times.length;
                const completionRate = Math.round((takenCount / totalTimes) * 100);

                return (
                  <div key={med.id} className="bg-white/80 backdrop-blur-sm shadow-xl rounded-3xl p-8 border border-white/20 hover:shadow-2xl transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">💊</span>
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-800">{med.name}</h3>
                            <p className="text-gray-600">{med.dosage}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4">
                            <p className="text-sm font-semibold text-blue-700 mb-1">Frequency</p>
                            <p className="text-blue-800 capitalize">{med.frequency}</p>
                          </div>
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4">
                            <p className="text-sm font-semibold text-purple-700 mb-1">Duration</p>
                            <p className="text-purple-800">{med.startDate} to {med.endDate}</p>
                          </div>
                          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4">
                            <p className="text-sm font-semibold text-green-700 mb-1">Progress</p>
                            <p className="text-green-800">{completionRate}% completed today</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {med.times.map((time, timeIndex) => (
                            <div key={timeIndex} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">⏰</span>
                                <div>
                                  <span className="font-semibold text-gray-800">Time {timeIndex + 1}</span>
                                  <p className="text-gray-600">{time}</p>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => updateMedicationStatus(med.id, time, today, 'taken')}
                                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                                    todayLogs[time] === 'taken'
                                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600 hover:text-white'
                                  }`}
                                >
                                  ✓ Taken
                                </button>
                                <button
                                  onClick={() => updateMedicationStatus(med.id, time, today, 'missed')}
                                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                                    todayLogs[time] === 'missed'
                                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 hover:text-white'
                                  }`}
                                >
                                  ✗ Missed
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl">
                          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>📊</span> Summary
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">{takenCount}</div>
                              <div className="text-sm text-gray-600">Taken</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">{missedCount}</div>
                              <div className="text-sm text-gray-600">Missed</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                              <div className="text-sm text-gray-600">Pending</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={() => deleteMedication(med.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-xl transition-all duration-300 font-semibold"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notification Permission */}
        {permission !== 'granted' && (
          <div className="mt-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔔</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Enable Notifications</h3>
            <p className="text-white/90 mb-6">Get reminded when it is time to take your medications</p>
            <button
              onClick={requestNotificationPermission}
              className="bg-white text-orange-600 font-semibold py-3 px-8 rounded-xl hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              Enable Notifications
            </button>
          </div>
        )}
      </div>
    </main>
  );
}