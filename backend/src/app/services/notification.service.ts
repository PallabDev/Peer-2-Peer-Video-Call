type PushNotificationInput = {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
};

export const sendExpoPushNotification = async (input: PushNotificationInput) => {
    if (!input.to) {
        return;
    }

    try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: input.to,
                title: input.title,
                body: input.body,
                sound: "default",
                priority: "high",
                data: input.data ?? {},
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.warn("Expo push failed", text);
        }
    } catch (error) {
        console.warn("Expo push request failed", error);
    }
};
