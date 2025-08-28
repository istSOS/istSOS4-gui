'use server'

const createData = async (
  endpoint: string,
  token: string,
  payload: Record<string, any>
) => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        "accept": "application/json",
        "commit-message": "test",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMsg = `Error fetching data: ${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        if (data?.message) errorMsg = data.message;
      } catch { }
      throw new Error(errorMsg);
    }
    return await response.json().catch(() => true);
  } catch (error) {
    throw error;
  }
}

export default createData