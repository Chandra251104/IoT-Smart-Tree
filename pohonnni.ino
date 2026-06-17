#include <WiFi.h>
#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;

// WIFI
const char* ssid = "SUTEKI COFFEE";
const char* password = "tehsusudingin";

WiFiServer server(80);

// PIN
#define SOIL_PIN 34
#define RAIN_PIN 27

// MPU
float refRoll = 0;
float refPitch = 0;
float smoothTilt = 0;
float alpha = 0.2;

// ================= MPU =================
void readAngle(float &roll, float &pitch) {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);

  float axf = ax;
  float ayf = ay;
  float azf = az;

  roll  = atan2(ayf, azf) * 180.0 / PI;
  pitch = atan2(axf, sqrt(ayf*ayf + azf*azf)) * 180.0 / PI;
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  Wire.begin(21, 22);
  mpu.initialize();

  pinMode(SOIL_PIN, INPUT);
  pinMode(RAIN_PIN, INPUT);

  // WIFI CONNECT
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.println(WiFi.localIP());

  server.begin();

  // Kalibrasi
  float sumRoll = 0, sumPitch = 0;

  for (int i = 0; i < 100; i++) {
    float r, p;
    readAngle(r, p);
    sumRoll += r;
    sumPitch += p;
    delay(20);
  }

  refRoll = sumRoll / 100;
  refPitch = sumPitch / 100;
}

// ================= LOOP =================
void loop() {

  // ===== SENSOR =====
  float roll, pitch;
  readAngle(roll, pitch);

  float devX = abs(roll - refRoll);
  float devY = abs(pitch - refPitch);
  float tiltRaw = max(devX, devY);

  smoothTilt = (alpha * tiltRaw) + ((1 - alpha) * smoothTilt);

  String statusTilt;
  if (smoothTilt <= 5) statusTilt = "NORMAL";
  else if (smoothTilt <= 11) statusTilt = "WASPADA";
  else statusTilt = "BAHAYA";

  int soilValue = analogRead(SOIL_PIN);
  int soilPercent = map(soilValue, 4095, 0, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  String statusSoil;
  if (soilPercent < 30) statusSoil = "KERING";
  else if (soilPercent < 60) statusSoil = "LEMBAP";
  else statusSoil = "BASAH";

  int rain = digitalRead(RAIN_PIN);
  String statusRain = (rain == 0) ? "HUJAN" : "TIDAK HUJAN";

  // ===== SERVER =====
  WiFiClient client = server.available();

  if (client) {
    String request = client.readStringUntil('\r');
    client.flush();

    // KIRIM JSON
    String json = "{";
    json += "\"tilt\":" + String(smoothTilt) + ",";
    json += "\"statusTilt\":\"" + statusTilt + "\",";
    json += "\"soil\":" + String(soilPercent) + ",";
    json += "\"statusSoil\":\"" + statusSoil + "\",";
    json += "\"rain\":\"" + statusRain + "\"";
    json += "}";

    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Connection: close");
    client.println();
    client.println(json);

    client.stop();
  }

  delay(500);
}