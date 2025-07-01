'use server';
const endpoint = "http://api:5000/istsos4/v1.1/Refresh";

const fetchRefresh = async (token: string) => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("Refresh failed");
    const data = await response.json();
    return data.access_token;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export default fetchRefresh;