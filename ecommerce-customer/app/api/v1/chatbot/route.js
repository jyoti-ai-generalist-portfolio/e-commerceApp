import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Expecting optional base64Image (data:image/jpeg;base64,...) from the client
    const { message, chatHistory, base64Image } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Format text history into standard chat roles
    const formattedHistory = (chatHistory || []).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    // Establish systemic scope guidelines
    const systemPrompt = {
      role: 'system',
      content: 'You are a helpful customer support assistant for our INR e-commerce storefront. Provide short, polite answers. You can look at uploaded images to help identify products, colors, or defects. For account, order, or refund tracking details, instruct the user to visit their account pages.'
    };

    // Construct user content payload dynamically (supporting multimodal arrays)
    const userContent = [];
    
    // Add text query
    userContent.push({ type: 'text', text: message });

    // Inject base64 image object if available
    if (base64Image) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: base64Image // Format: data:image/jpeg;base64,/9j/...
        }
      });
    }

    const currentUserMessage = {
      role: 'user',
      content: userContent
    };

    // Use Gemini's direct OpenAI-compatible endpoint
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Make sure GEMINI_API_KEY is defined in your environment variables
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-1.5-flash',
        messages: [systemPrompt, ...formattedHistory, currentUserMessage],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API Error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch AI response' }, { status: 502 });
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    return NextResponse.json({ reply: aiMessage });

  } catch (error) {
    console.error('Chatbot API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
