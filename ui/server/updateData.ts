'use server'

const updateData = async (
  endpoint: string,
  token: string,
  payload: Record<string, any>
) => {
  try {
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        "accept": "application/json",
        "commit-message": "update",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMsg = `Error updating data: ${response.status} ${response.statusText}`;
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

export default updateData;