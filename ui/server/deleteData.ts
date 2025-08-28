'use server'

const deleteData = async (endpoint: string, token: string) => {

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                "accept": "application/json",
                "commit-message": "test",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        //const data = JSON.parse(text);
        return text;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

export default deleteData