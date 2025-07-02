'use server'

const createData = async (
  endpoint: string,
  token: string,
  payload: Record<string, any> // accetta oggetti generici
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
      body: JSON.stringify(payload) // serializza l'oggetto
    });

    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
    }
    return true;
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

export default createData