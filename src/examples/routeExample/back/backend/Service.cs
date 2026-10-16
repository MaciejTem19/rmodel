using System.Text;

namespace backend;

public class Service
{
    private readonly Lock _lock = new();
    private readonly List<User> _users =
    [
        new(1, "janek", "JK-1234"),
        new(2, "ola", "OL-5678"),
    ];
    private readonly List<Card> _cards = [];
    private int _nextId = 1;

    public Service()
    {
        Seed(1, "Góry", "Wycieczka w Tatry, widok z Kasprowego Wierchu.", "#4a7c59");
        Seed(1, "Morze", "Zachód słońca nad Bałtykiem w Łebie.", "#2b6cb0");
        Seed(2, "Miasto", "Nocny spacer po krakowskim Rynku.", "#9b2c2c");
        Seed(2, "Las", "Jesienny las w Puszczy Białowieskiej.", "#b7791f");
    }

    public UserDTO? GetUser(int id)
    {
        var user = _users.Find(u => u.Id == id);
        return user is null ? null : new UserDTO(user.Nick, user.Code);
    }

    public IReadOnlyList<CardDTO> GetAll(int userId)
    {
        lock (_lock)
            return _cards.Where(c => c.UserId == userId).Select(ToDto).ToList();
    }

    // Pobranie textu traktujemy jako "kliknięcie" karty
    public string? GetText(int id)
    {
        lock (_lock)
        {
            var index = IndexOf(id);
            if (index < 0) return null;

            _cards[index] = _cards[index] with { LastClicked = DateTime.UtcNow };
            return _cards[index].Text;
        }
    }

    public byte[]? GetImage(int id)
    {
        lock (_lock)
        {
            var index = IndexOf(id);
            return index < 0 ? null : _cards[index].Image;
        }
    }

    public CardDTO Add(int userId, string title, string text, byte[] image)
    {
        lock (_lock)
        {
            var card = new Card(_nextId++, userId, title, DateTime.UtcNow, null, image, text);
            _cards.Add(card);
            return ToDto(card);
        }
    }

    public bool Delete(int id)
    {
        lock (_lock)
            return _cards.RemoveAll(c => c.Id == id) > 0;
    }

    public CardDTO? UpdateText(int id, string text)
    {
        lock (_lock)
        {
            var index = IndexOf(id);
            if (index < 0) return null;

            _cards[index] = _cards[index] with { Text = text };
            return ToDto(_cards[index]);
        }
    }

    public CardDTO? UpdateTitle(int id, string title)
    {
        lock (_lock)
        {
            var index = IndexOf(id);
            if (index < 0) return null;

            _cards[index] = _cards[index] with { Title = title };
            return ToDto(_cards[index]);
        }
    }

    private int IndexOf(int id) => _cards.FindIndex(c => c.Id == id);

    private static CardDTO ToDto(Card card) =>
        new(card.Title, card.Id, card.CreatedAt, card.LastClicked);

    private void Seed(int userId, string title, string text, string color)
    {
        var svg = $"""
            <svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
              <rect width="320" height="200" fill="{color}"/>
              <text x="160" y="110" font-family="sans-serif" font-size="32" fill="#fff" text-anchor="middle">{title}</text>
            </svg>
            """;
        Add(userId, title, text, Encoding.UTF8.GetBytes(svg));
    }
}
