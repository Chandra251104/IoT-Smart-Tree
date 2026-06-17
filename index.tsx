import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { initializeApp } from "firebase/app";
import { getDatabase, onValue, ref } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated, Easing, Platform,
  SafeAreaView, ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

// ================= MODE SIDANG =================
// true = aman (tidak spam alert)
// false = full mode (notif brutal)
const MODE_SIDANG = true;

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDv2hUVscXENGvrqorisvpPR4dG2Z6RLFU",
  authDomain: "monitoring-pohon.firebaseapp.com",
  databaseURL: "https://monitoring-pohon-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-pohon",
  storageBucket: "monitoring-pohon.firebasestorage.app",
  messagingSenderId: "610507172703",
  appId: "1:610507172703:web:0ec2920d0b4ca67cc6e4ea",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔊 Handler notif (WAJIB biar bunyi)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // ✅ Tambah ini
    shouldShowList: true,   // ✅ Tambah ini
  }),
});

export default function Index() {
  const [data, setData] = useState<any>(null);
  const lastStatus = useRef<string>("");
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const dangerInterval = useRef<any>(null);
  const latestTilt = useRef<number>(0); // Simpan tilt terbaru

  useEffect(() => {

    // ⚡ Android channel supaya notif berbunyi
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      }
      // 🔔 Minta izin notif
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: true },
      });
    })();

    const dbRef = ref(db, "monitoring/");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      setData(val);

      if (val) {
        latestTilt.current = val.tilt || 0; // update tilt terbaru

        // Animasi pohon
        Animated.timing(tiltAnim, {
          toValue: val.tilt || 0,
          duration: 800,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }).start();

        // 🚨 NOTIF BAHAYA
        if (val.statusTilt?.toLowerCase() === "bahaya") {

          // Alert hanya sekali (mode sidang aman)
          if (lastStatus.current !== "bahaya") {
            Alert.alert(
              "⚠️ KRITIS!", 
              `Kemiringan ${val.tilt?.toFixed(2)}° melebihi batas!`,
              [{ text: "Pantau" }]
            );
          }

          // 🔁 Notif berulang (full mode)
          if (!dangerInterval.current && !MODE_SIDANG) {
            dangerInterval.current = setInterval(async () => {

              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "⚠️ BAHAYA!",
                  body: `Kemiringan pohon ${latestTilt.current.toFixed(2)}°`,
                  sound: "default", // 🔊 wajib biar bunyi
                },
                trigger: null,
              });

              // 📳 getar keras
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error
              );

            }, 5000);
          }

          // Mode sidang: hanya 1 notif saja (tidak spam)
          if (MODE_SIDANG && lastStatus.current !== "bahaya") {
            Notifications.scheduleNotificationAsync({
              content: {
                title: "⚠️ DETEKSI BAHAYA",
                body: `Kemiringan ${latestTilt.current.toFixed(2)}°`,
                sound: "default",
              },
              trigger: null,
            });
          }

        } else {
          // Stop notif kalau aman
          if (dangerInterval.current) {
            clearInterval(dangerInterval.current);
            dangerInterval.current = null;
          }
        }

        lastStatus.current = val.statusTilt?.toLowerCase();
      }
    });

    return () => unsubscribe();
  }, []);

  const getThemeColor = () => {
    const status = data?.statusTilt?.toLowerCase();
    if (status === "bahaya") return "#EF5350";
    if (status === "waspada") return "#FFA726";
    return "#66BB6A";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.headerBg, { backgroundColor: getThemeColor() }]} />
      
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Sistem Deteksi Dini</Text>
            <Text style={styles.titleText}>Monitoring Pohon</Text>
          </View>
          <TouchableOpacity style={styles.iconCircle}>
            <Ionicons name="notifications" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Main Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTag}>SENSOR GYROSCOPE</Text>
            <View style={[styles.statusDot, { backgroundColor: getThemeColor() }]} />
          </View>

          <View style={styles.tiltContainer}>
            <Animated.View style={{ 
              transform: [{ 
                rotate: tiltAnim.interpolate({
                  inputRange: [-90, 0, 90],
                  outputRange: ['-90deg', '0deg', '90deg']
                }) 
              }] 
            }}>
              <MaterialCommunityIcons name="tree" size={140} color={getThemeColor()} />
            </Animated.View>
            
            <View style={styles.tiltValueBox}>
              <Text style={styles.bigValue}>
                {data?.tilt ? data.tilt.toFixed(2) : "0"}°
              </Text>
              <Text style={styles.subValueText}>Kemiringan</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.statusButton, { backgroundColor: getThemeColor() }]}>
            <Text style={styles.statusButtonText}>
              STATUS: {data?.statusTilt || "STABIL"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sensor Grid */}
        <View style={styles.grid}>
          <View style={styles.smallCard}>
            <Ionicons name="water" size={24} color="#42A5F5" />
            <Text style={styles.smallLabel}>Kelembapan</Text>
            <Text style={styles.smallValue}>{data?.soil ?? "0"}%</Text>
            <View style={styles.progressBase}>
              <View style={[styles.progressFill, { width: `${data?.soil || 0}%`, backgroundColor: '#42A5F5' }]} />
            </View>
          </View>

          <View style={styles.smallCard}>
            <Ionicons name={data?.rain === "HUJAN" ? "rainy" : "sunny"} size={24} color="#FFD54F" />
            <Text style={styles.smallLabel}>Intensitas Hujan</Text>
            <Text style={styles.smallValue}>{data?.rain ?? "Cerah"}</Text>
            <Text style={styles.hintText}>
              {data?.rain === "HUJAN" ? "Risiko Tinggi" : "Aman"}
            </Text>
          </View>
        </View>

        {/* Button */}
        <TouchableOpacity style={styles.primaryBtn}>
          <Text style={styles.btnText}>Perbarui Data Manual</Text>
          <Ionicons name="sync" size={20} color="#fff" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ================= STYLE =================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  scrollContainer: { padding: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 25 },
  welcomeText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  titleText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  glassCard: { backgroundColor: '#fff', borderRadius: 35, padding: 25, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTag: { fontSize: 11, fontWeight: '800', color: '#BBB' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  tiltContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginVertical: 30 },
  tiltValueBox: { alignItems: 'center' },
  bigValue: { fontSize: 55, fontWeight: '900', color: '#263238' },

  subValueText: { fontSize: 12, color: '#90A4AE' },

  statusButton: { padding: 18, borderRadius: 20, alignItems: 'center' },
  statusButtonText: { color: '#fff', fontWeight: '900' },

  grid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  smallCard: { backgroundColor: '#fff', width: '47%', borderRadius: 25, padding: 20 },
  smallLabel: { fontSize: 12, color: '#90A4AE' },
  smallValue: { fontSize: 20, fontWeight: '800' },

  progressBase: { height: 4, backgroundColor: '#ECEFF1' },
  progressFill: { height: '100%' },

  hintText: { fontSize: 10 },

  primaryBtn: { backgroundColor: '#263238', marginTop: 25, padding: 20, borderRadius: 25, flexDirection: 'row', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', marginRight: 10 }
});