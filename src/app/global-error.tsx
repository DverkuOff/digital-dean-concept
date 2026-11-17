"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 12, background: "#fff3d6", padding: 6 }}>
          Концепт для конкурса MGIMO×AI CHALLENGE, не официальный сервис, данные вымышлены
        </p>
        <h1>Что-то пошло не так</h1>
        <p>Попробуйте обновить страницу.</p>
        <button onClick={reset}>Повторить</button>
      </body>
    </html>
  );
}
