'use server';
const endpoint = "http://api:5000/istsos4/v1.1/Logout";

const fetchLogout = async (token: string) => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("Logout failed");
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export default fetchLogout;